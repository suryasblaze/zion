"""
The wallet.

Points only ever move through wallet_move(), the Postgres function in
002_referral_wallet.sql. That function takes a row lock on the user,
appends to the ledger and updates the cached balance in one atomic step,
and refuses to act twice on the same idempotency key.

Doing it in the database rather than in Python is deliberate: two Gunicorn
workers handling a double-clicked "Place order" cannot interleave a
read-modify-write, because they serialise on the same row lock.
"""
import math
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal

import db
from services import settings_service


# ----------------------------------------------------------- conversions
def points_to_rupees(points, cfg=None):
    """Coins -> money, rounded down so we never over-credit a customer."""
    cfg = cfg or settings_service.wallet_config()
    rate = Decimal(str(cfg["coins_per_rupee"]))
    if rate <= 0:
        return 0.0
    value = (Decimal(int(points)) / rate).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    return float(value)


def rupees_to_points(amount, cfg=None):
    """
    Money -> coins, rounded up, for "how many coins buy this much off?".
    Rounding up means the customer never ends up a paisa short.
    """
    cfg = cfg or settings_service.wallet_config()
    rate = Decimal(str(cfg["coins_per_rupee"]))
    return int(math.ceil(float(Decimal(str(amount)) * rate)))


def rupees_to_points_within(amount, cfg=None):
    """
    Money -> coins, rounded DOWN, for "the most coins allowed under this
    ceiling". Rounding up here would let the redemption exceed the cap the
    admin set: at 10 coins to the rupee a ceiling of 374.75 becomes 3748
    coins, which converts back to 374.80.
    """
    cfg = cfg or settings_service.wallet_config()
    rate = Decimal(str(cfg["coins_per_rupee"]))
    return int(math.floor(float(Decimal(str(amount)) * rate)))


# ---------------------------------------------------------------- reading
def balance(user_id):
    return db.scalar("select wallet_balance from users where id = %s", (user_id,)) or 0


def summary(user_id):
    cfg = settings_service.wallet_config()
    bal = balance(user_id)
    row = db.query_one(
        """select coalesce(sum(points) filter (where points > 0), 0) as earned,
                  coalesce(-sum(points) filter (where points < 0), 0) as spent
             from wallet_transactions where user_id = %s""",
        (user_id,),
    ) or {"earned": 0, "spent": 0}

    return {
        "balance": bal,
        "value": points_to_rupees(bal, cfg),
        "lifetime_earned": int(row["earned"]),
        "lifetime_spent": int(row["spent"]),
        "coin_name": cfg["coin_name"],
        "coins_per_rupee": cfg["coins_per_rupee"],
        "min_redeem_points": cfg["min_redeem_points"],
        "max_redeem_percent": cfg["max_redeem_percent"],
        "enabled": cfg["enabled"],
    }


def history(user_id, limit=50, offset=0):
    return db.query(
        """select id, type, points, balance_after, money_value,
                  reference_type, reference_id, note, created_at
             from wallet_transactions
            where user_id = %s
            order by created_at desc
            limit %s offset %s""",
        (user_id, limit, offset),
    )


# ---------------------------------------------------------------- writing
def move(cur, user_id, points, kind, reference_type=None, reference_id=None,
         idempotency_key=None, money_value=0, note=None, created_by=None):
    """
    Low-level move inside a caller-supplied transaction cursor.
    Positive points credit, negative points debit.
    """
    # Every argument is cast explicitly. Without this, psycopg sends a Python
    # float as `double precision`, and double precision -> numeric is only an
    # assignment cast, so Postgres cannot resolve the overload and reports the
    # function as not existing. Same reasoning for the uuid and integer args.
    cur.execute(
        """select * from wallet_move(
              p_user_id         := %s::uuid,
              p_points          := %s::integer,
              p_type            := %s::text,
              p_reference_type  := %s::text,
              p_reference_id    := %s::uuid,
              p_idempotency_key := %s::text,
              p_money_value     := %s::numeric,
              p_note            := %s::text,
              p_created_by      := %s::uuid)""",
        (user_id, int(points), kind, reference_type, reference_id,
         idempotency_key, money_value, note, created_by),
    )
    return cur.fetchone()


def credit(user_id, points, kind, **kwargs):
    """Standalone credit in its own transaction."""
    if points <= 0:
        return None
    with db.transaction() as cur:
        return move(cur, user_id, abs(int(points)), kind, **kwargs)


def debit(user_id, points, kind, **kwargs):
    """Standalone debit. Raises if the balance would go negative."""
    if points <= 0:
        return None
    with db.transaction() as cur:
        return move(cur, user_id, -abs(int(points)), kind, **kwargs)


# ------------------------------------------------------------- redemption
def redemption_quote(user_id, subtotal, requested_points=None):
    """
    How many coins may be spent on an order of this size, and what that is
    worth. Bounded by four things at once: the balance, the minimum
    redemption, the maximum share of an order payable in coins, and --
    when asked for a specific number -- the request itself.

    Pure calculation. Nothing is debited here.
    """
    cfg = settings_service.wallet_config()
    bal = balance(user_id)

    result = {
        "enabled": cfg["enabled"],
        "balance": bal,
        "coin_name": cfg["coin_name"],
        "coins_per_rupee": cfg["coins_per_rupee"],
        "applicable_points": 0,
        "discount": 0.0,
        "max_points": 0,
        "max_discount": 0.0,
        "reason": None,
    }

    if not cfg["enabled"]:
        result["reason"] = "The wallet is currently switched off."
        return result

    if bal < cfg["min_redeem_points"]:
        result["reason"] = (
            f"You need at least {cfg['min_redeem_points']:,} {cfg['coin_name']} to redeem. "
            f"You have {bal:,}."
        )
        return result

    # Ceiling from the admin's max-share-of-order rule.
    cap_money = (
        Decimal(str(subtotal)) * Decimal(str(cfg["max_redeem_percent"])) / Decimal(100)
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    cap_points = min(bal, rupees_to_points_within(cap_money, cfg))
    result["max_points"] = cap_points
    result["max_discount"] = points_to_rupees(cap_points, cfg)

    if cap_points <= 0:
        result["reason"] = "This order is too small to redeem against."
        return result

    points = cap_points if requested_points is None else min(int(requested_points), cap_points)
    if points < cfg["min_redeem_points"]:
        points = 0

    result["applicable_points"] = points
    result["discount"] = points_to_rupees(points, cfg)
    return result
