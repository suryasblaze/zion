"""
The referral programme.

Lifecycle of one referral
-------------------------
  1. CLICK     Someone opens /r/<CODE>. We log a referral_clicks row and
               set an anonymous visitor cookie. Nobody has signed up yet.
  2. ATTACH    That visitor registers. attach_referral() creates exactly
               one referrals row linking referrer -> referee, snapshots
               the current reward rules onto it, runs the fraud checks,
               and pays the referee's welcome points.
  3. DISCOUNT  The referee checks out. quote_referee_discount() offers the
               snapshotted discount on their first order only.
  4. REWARD    That order is paid (or delivered, per settings).
               on_order_paid() credits the referrer's wallet, once.
  5. REVERSE   If the order is later refunded, on_order_reversed() claws
               the points back.

Everything that must happen at most once carries an idempotency key, so a
retried webhook, a double-clicked button, or two workers racing all land
on the same ledger row instead of paying twice.

Rules are read from admin_settings at the moment a referral is created and
then frozen onto the row. Changing the reward tomorrow does not rewrite
what someone was promised today.
"""
import json
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

import db
from services import settings_service, wallet_service
from utils.helpers import now


# ------------------------------------------------------------------ reads
def resolve_code(code):
    """The owner of a referral code, if it belongs to a live account."""
    if not code:
        return None
    return db.query_one(
        """select id, full_name, referral_code
             from users
            where referral_code = %s and is_active and role <> 'staff'""",
        (code.strip().upper(),),
    )


def track_click(code, visitor_token=None, ip_hash=None, user_agent=None,
                landing_path=None, referer=None, utm=None):
    """
    Log a referral link visit. Returns the referrer so the storefront can
    say who invited you, plus the discount on offer.
    """
    referrer = resolve_code(code)
    if not referrer:
        return None

    row = db.insert_returning(
        """insert into referral_clicks
             (code, referrer_id, visitor_token, ip_hash, user_agent,
              landing_path, referer_url, utm)
           values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
           returning id, created_at""",
        (referrer["referral_code"], referrer["id"], visitor_token, ip_hash,
         (user_agent or "")[:500], landing_path, referer, json.dumps(utm or {})),
    )

    cfg = settings_service.referral_config()
    return {
        "click_id": row["id"],
        "referrer_name": referrer["full_name"] or "A friend",
        "code": referrer["referral_code"],
        "discount_label": describe_discount(cfg),
        "enabled": cfg["enabled"],
    }


def describe_discount(cfg=None):
    """Human wording for the referee's offer, e.g. '10% off' or '₹150 off'."""
    cfg = cfg or settings_service.referral_config()
    value = cfg["referee_discount_value"]
    if value <= 0:
        return None
    if cfg["referee_discount_type"] == "percent":
        pretty = int(value) if float(value).is_integer() else value
        return f"{pretty}% off"
    symbol = settings_service.get_str("store.currency_symbol", "₹")
    return f"{symbol}{int(value):,} off"


# ----------------------------------------------------------------- attach
def _fraud_flags(cur, referrer, email, phone, ip_hash, device_hash, cfg):
    """
    Heuristics for the same person signing up under a second identity.
    These raise flags; they do not silently drop the referral. A real
    customer who shares a household router should not lose their reward
    without a human looking at it.
    """
    flags = []

    if cfg["block_same_ip"] and ip_hash:
        cur.execute("select signup_ip_hash from users where id = %s", (referrer["id"],))
        row = cur.fetchone()
        if row and row["signup_ip_hash"] and row["signup_ip_hash"] == ip_hash:
            flags.append("same_ip_as_referrer")

    if cfg["block_same_device"] and device_hash:
        cur.execute("select signup_device_id from users where id = %s", (referrer["id"],))
        row = cur.fetchone()
        if row and row["signup_device_id"] and row["signup_device_id"] == device_hash:
            flags.append("same_device_as_referrer")

    # Gmail-style plus addressing and dot tricks resolve to one inbox.
    cur.execute("select email from users where id = %s", (referrer["id"],))
    ref_email = (cur.fetchone() or {}).get("email") or ""
    if _normalise_email(ref_email) == _normalise_email(email):
        flags.append("same_email_root")

    if cfg["max_rewards_per_user"] > 0:
        cur.execute(
            "select count(*) as n from referrals where referrer_id = %s and status = 'rewarded'",
            (referrer["id"],),
        )
        if (cur.fetchone() or {"n": 0})["n"] >= cfg["max_rewards_per_user"]:
            flags.append("referrer_at_reward_cap")

    return flags


def _normalise_email(email):
    email = (email or "").strip().lower()
    if "@" not in email:
        return email
    local, domain = email.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local = local.replace(".", "")
    return f"{local}@{domain}"


def attach_referral(cur, new_user, code, visitor_token=None, ip_hash=None,
                    device_hash=None):
    """
    Called inside the signup transaction. Creates the referral, freezes
    the rules onto it, and credits the referee's welcome points.

    Returns a dict describing what happened, or None if no referral
    applied. Never raises for an ordinary "bad code" -- a broken link must
    not cost someone their registration.
    """
    cfg = settings_service.referral_config()
    if not cfg["enabled"] or not code:
        return None

    cur.execute(
        """select id, full_name, email, referral_code
             from users
            where referral_code = %s and is_active
            for update""",
        (code.strip().upper(),),
    )
    referrer = cur.fetchone()
    if not referrer or referrer["id"] == new_user["id"]:
        return None

    flags = _fraud_flags(cur, referrer, new_user["email"], new_user.get("phone"),
                         ip_hash, device_hash, cfg)

    # The unique constraint on referee_id is the real guarantee here; this
    # insert simply becomes a no-op if a referral already exists.
    cur.execute(
        """insert into referrals
             (referrer_id, referee_id, code, status,
              referee_discount_type, referee_discount_value,
              referrer_points_config, referee_points_config, fraud_flags)
           values (%s, %s, %s, 'pending', %s, %s, %s, %s, %s::jsonb)
           on conflict (referee_id) do nothing
           returning id""",
        (referrer["id"], new_user["id"], referrer["referral_code"],
         cfg["referee_discount_type"], cfg["referee_discount_value"],
         cfg["referrer_points"], cfg["referee_welcome_points"],
         json.dumps(flags)),
    )
    created = cur.fetchone()
    if not created:
        return None
    referral_id = created["id"]

    cur.execute("update users set referred_by = %s where id = %s",
                (referrer["id"], new_user["id"]))

    # Tie the originating click to this signup, for the analytics.
    if visitor_token:
        cur.execute(
            """update referral_clicks
                  set converted_user_id = %s, converted_at = now()
                where visitor_token = %s and code = %s and converted_user_id is null""",
            (new_user["id"], visitor_token, referrer["referral_code"]),
        )

    # Welcome points land immediately -- they cost nothing until spent and
    # they are the reason the new customer finishes signing up.
    welcome = 0
    if cfg["referee_welcome_points"] > 0 and not flags:
        wallet_service.move(
            cur, new_user["id"], cfg["referee_welcome_points"], "welcome_bonus",
            reference_type="referral", reference_id=referral_id,
            idempotency_key=f"welcome:{referral_id}",
            note=f"Welcome bonus for joining through {referrer['full_name'] or 'a friend'}",
        )
        welcome = cfg["referee_welcome_points"]
        cur.execute(
            "update referrals set referee_points_awarded = %s where id = %s",
            (welcome, referral_id),
        )

    return {
        "referral_id": referral_id,
        "referrer_name": referrer["full_name"] or "A friend",
        "welcome_points": welcome,
        "discount_label": describe_discount(cfg),
        "flagged": bool(flags),
    }


# --------------------------------------------------------------- discount
def pending_referral_for(user_id):
    """The referral this customer can still claim a first-order discount on."""
    return db.query_one(
        """select id, referrer_id, referee_discount_type, referee_discount_value,
                  status, qualifying_order_id
             from referrals
            where referee_id = %s
              and status in ('pending','qualified')
              and qualifying_order_id is null""",
        (user_id,),
    )


def quote_referee_discount(user_id, subtotal):
    """
    The referred customer's first-order discount. Pure calculation;
    nothing is written. Returns 0 when it does not apply.
    """
    cfg = settings_service.referral_config()
    blank = {"amount": 0.0, "label": None, "referral_id": None, "reason": None}

    if not cfg["enabled"]:
        return blank

    referral = pending_referral_for(user_id)
    if not referral:
        # Already used, or never referred. Only the former needs explaining.
        used = db.scalar(
            """select 1 from referrals
                where referee_id = %s and qualifying_order_id is not null""",
            (user_id,),
        )
        if used:
            return {**blank,
                    "reason": "Your referral discount was used on your first order."}
        return blank

    # First order only. Anything already paid disqualifies.
    prior = db.scalar(
        """select count(*) from orders
            where user_id = %s and payment_status = 'paid'""",
        (user_id,),
    )
    if prior:
        return {**blank, "reason": "The referral discount applies to your first order."}

    subtotal = Decimal(str(subtotal))
    if subtotal < Decimal(str(cfg["referee_min_order"])):
        symbol = settings_service.get_str("store.currency_symbol", "₹")
        return {
            **blank,
            "reason": f"Spend {symbol}{cfg['referee_min_order']:,.0f} to use your referral discount.",
        }

    # Snapshotted rules, not today's.
    if referral["referee_discount_type"] == "percent":
        amount = subtotal * Decimal(str(referral["referee_discount_value"])) / Decimal(100)
        cap = Decimal(str(cfg["referee_discount_max"]))
        if cap > 0:
            amount = min(amount, cap)
    else:
        amount = Decimal(str(referral["referee_discount_value"]))

    amount = min(amount, subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "amount": float(amount),
        "label": describe_discount(cfg),
        "referral_id": referral["id"],
        "reason": None,
    }


# ----------------------------------------------------------------- reward
def on_order_paid(order_id, force=False):
    """
    The reward trigger. Safe to call repeatedly -- from the payment
    webhook, from the admin marking an order paid, and from a retry of
    either. Only the first call moves any points.
    """
    cfg = settings_service.referral_config()
    if not cfg["enabled"]:
        return {"rewarded": False, "reason": "programme_disabled"}

    with db.transaction() as cur:
        # Lock the order so two webhooks cannot both decide to pay.
        cur.execute(
            """select id, user_id, payment_status, status, subtotal, referral_discount
                 from orders where id = %s for update""",
            (order_id,),
        )
        order = cur.fetchone()
        if not order or not order["user_id"]:
            return {"rewarded": False, "reason": "order_not_found"}

        if cfg["qualify_on"] == "order_delivered" and order["status"] != "delivered":
            return {"rewarded": False, "reason": "awaiting_delivery"}
        if cfg["qualify_on"] == "order_paid" and order["payment_status"] != "paid":
            return {"rewarded": False, "reason": "not_paid"}

        cur.execute(
            """select * from referrals
                where referee_id = %s and status in ('pending','qualified')
                for update""",
            (order["user_id"],),
        )
        referral = cur.fetchone()
        if not referral:
            return {"rewarded": False, "reason": "no_referral"}

        # Mark the order as the qualifying one, whatever happens next.
        cur.execute(
            """update referrals
                  set qualifying_order_id = %s,
                      referee_discount_applied = %s,
                      status = case when status = 'pending' then 'qualified' else status end,
                      qualified_at = coalesce(qualified_at, now())
                where id = %s""",
            (order["id"], order["referral_discount"], referral["id"]),
        )
        cur.execute("update orders set referral_code_used = %s where id = %s",
                    (referral["code"], order["id"]))

        flags = referral["fraud_flags"] or []
        if flags and not cfg["auto_approve_flagged"] and not force:
            return {"rewarded": False, "reason": "held_for_review",
                    "referral_id": referral["id"], "flags": flags}

        if cfg["reward_hold_days"] > 0 and not force:
            due = now() + timedelta(days=cfg["reward_hold_days"])
            return {"rewarded": False, "reason": "on_hold", "pay_after": due.isoformat(),
                    "referral_id": referral["id"]}

        return _pay_referrer(cur, referral)


def _release_welcome(cur, referral):
    """
    Pay the referee's welcome bonus if it was withheld at signup.

    attach_referral() holds the bonus back when the fraud checks raise a
    flag, so that a suspected fake account is not funded before a human has
    looked at it. Once the referral is approved, the friend is owed it.
    """
    owed = int(referral["referee_points_config"] or 0)
    if owed <= 0 or int(referral["referee_points_awarded"] or 0) > 0:
        return 0

    wallet_service.move(
        cur, referral["referee_id"], owed, "welcome_bonus",
        reference_type="referral", reference_id=referral["id"],
        idempotency_key=f"welcome:{referral['id']}",
        note="Welcome bonus, released on review",
    )
    cur.execute("update referrals set referee_points_awarded = %s where id = %s",
                (owed, referral["id"]))
    return owed


def _pay_referrer(cur, referral):
    """Credit the referrer. Assumes the caller holds the referral row lock."""
    _release_welcome(cur, referral)
    points = int(referral["referrer_points_config"] or 0)
    if points <= 0:
        cur.execute(
            "update referrals set status = 'rewarded', rewarded_at = now() where id = %s",
            (referral["id"],),
        )
        return {"rewarded": True, "points": 0, "referral_id": referral["id"]}

    txn = wallet_service.move(
        cur, referral["referrer_id"], points, "referral_reward",
        reference_type="referral", reference_id=referral["id"],
        idempotency_key=f"referral_reward:{referral['id']}",
        money_value=wallet_service.points_to_rupees(points),
        note="Referral reward",
    )

    cur.execute(
        """update referrals
              set status = 'rewarded',
                  referrer_points_awarded = %s,
                  rewarded_at = now()
            where id = %s""",
        (points, referral["id"]),
    )

    return {
        "rewarded": True,
        "points": points,
        "referral_id": referral["id"],
        "referrer_id": referral["referrer_id"],
        "balance_after": txn["balance_after"] if txn else None,
    }


def approve_flagged(referral_id, actor_id=None):
    """Admin override: pay a referral that the fraud checks held back."""
    with db.transaction() as cur:
        cur.execute("select * from referrals where id = %s for update", (referral_id,))
        referral = cur.fetchone()
        if not referral:
            return {"rewarded": False, "reason": "not_found"}
        if referral["status"] == "rewarded":
            return {"rewarded": False, "reason": "already_rewarded"}
        if not referral["qualifying_order_id"]:
            return {"rewarded": False, "reason": "no_qualifying_order"}
        return _pay_referrer(cur, referral)


def reject(referral_id, reason, actor_id=None):
    return db.execute(
        """update referrals
              set status = 'rejected', rejected_reason = %s
            where id = %s and status <> 'rewarded'""",
        (reason, referral_id),
    )


def process_due_rewards():
    """
    Pays referrals whose hold period has elapsed. Wire to a daily cron, or
    trigger from Admin > Referrals > Pay due rewards.
    """
    cfg = settings_service.referral_config()
    if not cfg["enabled"] or cfg["reward_hold_days"] <= 0:
        return {"paid": 0}

    cutoff = now() - timedelta(days=cfg["reward_hold_days"])
    due = db.query(
        """select id from referrals
            where status = 'qualified'
              and qualified_at <= %s
              and (fraud_flags = '[]'::jsonb or %s)""",
        (cutoff, cfg["auto_approve_flagged"]),
    )

    paid = 0
    for row in due:
        with db.transaction() as cur:
            cur.execute("select * from referrals where id = %s for update", (row["id"],))
            referral = cur.fetchone()
            if referral and referral["status"] == "qualified":
                _pay_referrer(cur, referral)
                paid += 1
    return {"paid": paid}


def on_order_reversed(order_id, reason="Order refunded"):
    """
    Claw back a reward when the qualifying order is refunded or cancelled.
    The debit is allowed to fail: if the referrer has already spent the
    points we take the loss rather than forcing a negative balance.
    """
    with db.transaction() as cur:
        cur.execute(
            "select * from referrals where qualifying_order_id = %s for update",
            (order_id,),
        )
        referral = cur.fetchone()
        if not referral or referral["status"] != "rewarded":
            return {"reversed": False, "reason": "nothing_to_reverse"}

        points = int(referral["referrer_points_awarded"] or 0)
        if points > 0:
            try:
                wallet_service.move(
                    cur, referral["referrer_id"], -points, "reversal",
                    reference_type="referral", reference_id=referral["id"],
                    idempotency_key=f"referral_reversal:{referral['id']}",
                    note=reason,
                )
            except Exception:
                # Already spent. Record the reversal without the debit.
                cur.execute(
                    """update referrals
                          set status = 'reversed',
                              rejected_reason = %s
                        where id = %s""",
                    (f"{reason} (points already spent)", referral["id"]),
                )
                return {"reversed": True, "points": 0, "note": "points_already_spent"}

        cur.execute(
            "update referrals set status = 'reversed', rejected_reason = %s where id = %s",
            (reason, referral["id"]),
        )
        return {"reversed": True, "points": points}


# ------------------------------------------------------------------ stats
def stats_for(user_id):
    row = db.query_one(
        "select * from referral_stats where referrer_id = %s", (user_id,)
    ) or {}
    cfg = settings_service.referral_config()
    site = settings_service.get_str("seo.site_url", "").rstrip("/")
    code = row.get("referral_code") or db.scalar(
        "select referral_code from users where id = %s", (user_id,)
    )

    recent = db.query(
        """select r.id, r.status, r.created_at, r.rewarded_at,
                  r.referrer_points_awarded, r.fraud_flags,
                  u.full_name, u.created_at as joined_at
             from referrals r
             join users u on u.id = r.referee_id
            where r.referrer_id = %s
            order by r.created_at desc
            limit 25""",
        (user_id,),
    )

    return {
        "code": code,
        "link": f"{site}/r/{code}" if site else f"/r/{code}",
        "clicks": int(row.get("clicks") or 0),
        "signups": int(row.get("signups") or 0),
        "conversions": int(row.get("conversions") or 0),
        "points_earned": int(row.get("points_earned") or 0),
        "signup_rate_pct": float(row.get("signup_rate_pct") or 0),
        "discount_label": describe_discount(cfg),
        "reward_points": cfg["referrer_points"],
        "share_message": cfg["share_message"],
        "enabled": cfg["enabled"],
        "referrals": recent,
    }
