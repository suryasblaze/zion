"""
Per-order rewards, against the real database.

    python tests/test_order_rewards.py

Builds two linked accounts (A refers B, B refers C), pays for orders,
and checks who was credited what. Everything it creates is removed at
the end, including on failure.

Worth stating what this is really guarding. The arithmetic is easy; the
things that break in production are paying twice because a webhook
arrived twice, paying a grandparent because someone walked the chain one
hop too far, and a refund that cannot claw money back because it was
already spent. Those are what the checks below are about.
"""
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db                                  # noqa: E402
from services import referral_service, settings_service, wallet_service  # noqa: E402

PASS, FAIL = 0, 0
TAG = f"rwtest-{uuid.uuid4().hex[:8]}"


def check(label, got, want=True):
    global PASS, FAIL
    ok = got == want
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + ("" if ok else f"   got {got!r}, want {want!r}"))
    if ok:
        PASS += 1
    else:
        FAIL += 1


def head(title):
    print(f"\n{title}\n{'-' * len(title)}")


def make_user(name, referred_by=None, flags=None):
    """
    Creates the account and, when referred, the referrals row.

    Commission reads `referrals` rather than users.referred_by, because
    that is where the fraud flags live -- so a test that only set
    referred_by would pass while the real signup path was being blocked.
    """
    row = db.query_one(
        """insert into users (email, password_hash, full_name, role, referral_code, referred_by)
           values (%s, %s, %s, 'customer', %s, %s)
           returning id""",
        (f"{TAG}-{name}@example.invalid", "x" * 40, f"Test {name}",
         f"{TAG[-6:].upper()}{name}", referred_by),
    )
    uid = row["id"]
    if referred_by:
        db.execute(
            """insert into referrals
                 (referrer_id, referee_id, code, status, referee_discount_type,
                  referee_discount_value, fraud_flags)
               values (%s, %s, %s, 'rewarded', 'percent', 0, %s::jsonb)""",
            (referred_by, uid, f"{TAG[-6:].upper()}{name}",
             json.dumps(flags or [])),
        )
    return uid


def make_order(user_id, subtotal, number):
    row = db.query_one(
        """insert into orders
             (order_number, user_id, email, status, payment_status, payment_method,
              subtotal, total, currency, shipping_address, billing_address)
           values (%s, %s, %s, 'pending', 'unpaid', 'cod', %s, %s, 'INR',
                   '{}'::jsonb, '{}'::jsonb)
           returning id""",
        (number, user_id, f"{TAG}@example.invalid", subtotal, subtotal),
    )
    return row["id"]


def balance(user_id):
    return db.scalar("select wallet_balance from users where id = %s", (user_id,)) or 0


def cleanup(*user_ids):
    """
    Remove everything this run created.

    Children first and one statement at a time, rather than leaning on
    cascades. A single delete that walks orders, items, events, wallet
    rows and the referrals graph is slow enough over a pooled connection
    to hit the server's statement timeout -- and a timeout mid-delete
    leaves the transaction open, holding row locks that outlive the
    process. That happened, and the locks sat there until someone killed
    the session by hand.

    Nothing here is allowed to raise: a test that cannot tidy up should
    say so and still let the pool close.
    """
    for uid in user_ids:
        if not uid:
            continue
        for sql in (
            "delete from wallet_transactions where user_id = %s",
            "delete from order_rewards where user_id = %s",
            "delete from referrals where referrer_id = %s or referee_id = %s",
            "delete from order_items where order_id in (select id from orders where user_id = %s)",
            "delete from order_events where order_id in (select id from orders where user_id = %s)",
            "delete from orders where user_id = %s",
            "delete from users where id = %s",
        ):
            params = (uid, uid) if sql.count("%s") == 2 else (uid,)
            try:
                db.execute(sql, params)
            except Exception as exc:
                print(f"  (cleanup) {sql.split()[2]}: {str(exc)[:60]}")


def main():
    db.init_pool()
    a = bb = c = None
    extra = []

    # Set known rates for the duration, then put back whatever was there.
    before = {
        k: settings_service.get(k)
        for k in ("referral.commission_percent", "referral.self_cashback_percent",
                  "referral.reward_min_order", "referral.qualify_on", "referral.enabled",
                  "referral.auto_approve_flagged")
    }
    try:
        settings_service.set_many({
            "referral.enabled": True,
            "referral.commission_percent": 2,
            "referral.self_cashback_percent": 5,
            "referral.reward_min_order": 0,
            "referral.qualify_on": "order_paid",
        })

        head("Setup: A refers B, B refers C")
        a = make_user("a")
        bb = make_user("b", referred_by=a)
        c = make_user("c", referred_by=bb)
        check("three accounts created", all([a, bb, c]))
        check("B's referrer is A", str(db.scalar(
            "select referred_by from users where id = %s", (bb,))) == str(a))

        rate = settings_service.wallet_config()["coins_per_rupee"]
        print(f"  (coins per rupee: {rate})")

        # ----------------------------------------------------------------
        head("B orders Rs 1,000")
        o1 = make_order(bb, 1000, f"{TAG}-1")
        db.execute("update orders set payment_status = 'paid' where id = %s", (o1,))

        a0, b0 = balance(a), balance(bb)
        res = referral_service.on_order_rewards(o1)
        kinds = sorted(p["kind"] for p in res["paid"])
        check("both rewards paid", kinds, ["commission", "self_cashback"])

        want_self = wallet_service.rupees_to_points(50.0)     # 5% of 1000
        want_comm = wallet_service.rupees_to_points(20.0)     # 2% of 1000
        check(f"B earned cashback ({want_self} pts)", balance(bb) - b0, want_self)
        check(f"A earned commission ({want_comm} pts)", balance(a) - a0, want_comm)

        # ----------------------------------------------------------------
        head("The same order is processed again (a second webhook)")
        a1, b1 = balance(a), balance(bb)
        again = referral_service.on_order_rewards(o1)
        check("nothing paid twice", again["paid"], [])
        check("B's balance unchanged", balance(bb), b1)
        check("A's balance unchanged", balance(a), a1)
        check("one row per kind", db.scalar(
            "select count(*) from order_rewards where order_id = %s", (o1,)), 2)

        # ----------------------------------------------------------------
        head("C orders Rs 500 -- A is the grandparent and must earn nothing")
        o2 = make_order(c, 500, f"{TAG}-2")
        db.execute("update orders set payment_status = 'paid' where id = %s", (o2,))

        a2, b2, c2 = balance(a), balance(bb), balance(c)
        referral_service.on_order_rewards(o2)

        check("C earned cashback", balance(c) - c2,
              wallet_service.rupees_to_points(25.0))          # 5% of 500
        check("B earned commission", balance(bb) - b2,
              wallet_service.rupees_to_points(10.0))          # 2% of 500
        check("A earned NOTHING from C", balance(a) - a2, 0)

        # ----------------------------------------------------------------
        head("B's order is refunded")
        a3, b3 = balance(a), balance(bb)
        rev = referral_service.on_order_rewards_reversed(o2, "Test refund")
        check("both reversals attempted", len(rev), 2)
        check("all reversed", all(r["reversed"] for r in rev))
        check("C's commission taken back from B", b3 - balance(bb),
              wallet_service.rupees_to_points(10.0))
        check("A still untouched", balance(a), a3)
        check("reversal is recorded", db.scalar(
            "select count(*) from order_rewards where order_id = %s and reversed_at is not null",
            (o2,)), 2)

        # ----------------------------------------------------------------
        head("Reversing twice does not double-charge")
        b4 = balance(bb)
        rev2 = referral_service.on_order_rewards_reversed(o2, "Test refund again")
        check("nothing left to reverse", rev2, [])
        check("balance unchanged", balance(bb), b4)

        # ----------------------------------------------------------------
        head("Rates at zero pay nothing")
        settings_service.set_many({"referral.commission_percent": 0,
                                   "referral.self_cashback_percent": 0})
        o3 = make_order(bb, 1000, f"{TAG}-3")
        db.execute("update orders set payment_status = 'paid' where id = %s", (o3,))
        b5 = balance(bb)
        off = referral_service.on_order_rewards(o3)
        check("reason given", off.get("reason"), "rates_are_zero")
        check("no points moved", balance(bb), b5)

        # ----------------------------------------------------------------
        head("A minimum order is respected")
        settings_service.set_many({"referral.commission_percent": 2,
                                   "referral.self_cashback_percent": 5,
                                   "referral.reward_min_order": 500})
        o4 = make_order(bb, 100, f"{TAG}-4")
        db.execute("update orders set payment_status = 'paid' where id = %s", (o4,))
        b6 = balance(bb)
        small = referral_service.on_order_rewards(o4)
        check("small order skipped", small.get("reason"), "below_minimum")
        check("no points moved", balance(bb), b6)

        # ----------------------------------------------------------------
        head("A flagged referral earns no commission")
        settings_service.set_many({"referral.commission_percent": 2,
                                   "referral.self_cashback_percent": 5,
                                   "referral.reward_min_order": 0,
                                   "referral.auto_approve_flagged": False})
        d = make_user("d", referred_by=a, flags=["same_device"])
        o5 = make_order(d, 1000, f"{TAG}-5")
        db.execute("update orders set payment_status = 'paid' where id = %s", (o5,))

        a4, d0 = balance(a), balance(d)
        res5 = referral_service.on_order_rewards(o5)
        held = [p for p in res5["paid"] if p.get("reason") == "held_for_review"]

        check("commission held for review", len(held), 1)
        check("referrer earned nothing", balance(a) - a4, 0)
        check("buyer still got their cashback", balance(d) - d0,
              wallet_service.rupees_to_points(50.0))
        check("no commission row written", db.scalar(
            "select count(*) from order_rewards where order_id = %s and kind = 'commission'",
            (o5,)), 0)

        extra.append(d)

    finally:
        settings_service.set_many({k: v for k, v in before.items() if v is not None})
        cleanup(a, bb, c)
        print(f"\n{'=' * 46}")
        print(f"  {PASS} passed, {FAIL} failed")
        print(f"{'=' * 46}\n")
        db.close_pool()

    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
