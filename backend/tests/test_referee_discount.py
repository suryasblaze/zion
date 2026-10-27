"""
The referred customer's discount, in both modes.

    python tests/test_referee_discount.py

The one that matters is the second order. With the discount set to
one-time it must be zero there, and with it set to standing it must be
the full amount again -- those two are the whole feature, and the bug
that prompted this was the second order silently getting nothing when
someone expected otherwise.
"""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db                                              # noqa: E402
from services import referral_service, settings_service  # noqa: E402

PASS = FAIL = 0
TAG = f"disctest-{uuid.uuid4().hex[:8]}"


def check(label, got, want=True):
    global PASS, FAIL
    ok = got == want
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + ("" if ok else f"   got {got!r}, want {want!r}"))
    globals().__setitem__('PASS' if ok else 'FAIL', (PASS if ok else FAIL) + 1)


def head(t):
    print(f"\n{t}\n{'-' * len(t)}")


def make_user(name, referred_by=None, flags=None):
    import json
    row = db.query_one(
        """insert into users (email, password_hash, full_name, role, referral_code, referred_by)
           values (%s,'x',%s,'customer',%s,%s) returning id""",
        (f"{TAG}-{name}@example.invalid", f"Disc {name}", f"{TAG[-6:].upper()}{name}", referred_by),
    )
    uid = row["id"]
    if referred_by:
        db.execute(
            """insert into referrals
                 (referrer_id, referee_id, code, status,
                  referee_discount_type, referee_discount_value, fraud_flags)
               values (%s,%s,%s,'pending','percent',20,%s::jsonb)""",
            (referred_by, uid, f"{TAG[-6:].upper()}{name}", json.dumps(flags or [])),
        )
    return uid


def paid_order(uid, n, subtotal=500):
    row = db.query_one(
        """insert into orders (order_number, user_id, email, status, payment_status,
                               payment_method, subtotal, total, currency,
                               shipping_address, billing_address)
           values (%s,%s,%s,'delivered','paid','cod',%s,%s,'INR','{}'::jsonb,'{}'::jsonb)
           returning id""",
        (f"{TAG}-{n}", uid, f"{TAG}@example.invalid", subtotal, subtotal),
    )
    return row["id"]


def cleanup(*uids):
    for uid in uids:
        if not uid:
            continue
        for sql in ("delete from order_rewards where user_id = %s",
                    "delete from wallet_transactions where user_id = %s",
                    "delete from referrals where referrer_id = %s or referee_id = %s",
                    "delete from orders where user_id = %s",
                    "delete from users where id = %s"):
            try:
                db.execute(sql, (uid, uid) if sql.count("%s") == 2 else (uid,))
            except Exception as exc:
                print(f"  (cleanup) {str(exc)[:60]}")


def main():
    db.init_pool()
    a = b = None
    keys = ("referral.referee_discount_every_order", "referral.referee_min_order",
            "referral.referee_discount_value", "referral.referee_discount_type",
            "referral.enabled", "referral.auto_approve_flagged")
    before = {k: settings_service.get(k) for k in keys}

    try:
        settings_service.set_many({
            "referral.enabled": True,
            "referral.referee_discount_type": "percent",
            "referral.referee_discount_value": 20,
            "referral.referee_min_order": 0,
            "referral.auto_approve_flagged": False,
            "referral.referee_discount_every_order": False,
        })

        a = make_user("a")
        b = make_user("b", referred_by=a)

        # ------------------------------------------------ one-time mode
        head("One-time mode (the old behaviour)")
        q1 = referral_service.quote_referee_discount(b, 500)
        check("first order gets 20% of 500", q1["amount"], 100.0)

        paid_order(b, 1)
        q2 = referral_service.quote_referee_discount(b, 500)
        check("second order gets nothing", q2["amount"], 0.0)
        check("and says why", "first order" in (q2["reason"] or ""))

        # ------------------------------------------------ standing mode
        head("Standing mode (every order)")
        settings_service.set_many({"referral.referee_discount_every_order": True})

        q3 = referral_service.quote_referee_discount(b, 500)
        check("second order now gets 20% too", q3["amount"], 100.0)
        check("no refusal reason", q3["reason"], None)

        paid_order(b, 2)
        q4 = referral_service.quote_referee_discount(b, 800)
        check("third order gets 20% of 800", q4["amount"], 160.0)

        # ------------------------------------------------- the guards
        head("Guards still apply in standing mode")
        settings_service.set_many({"referral.referee_min_order": 600})
        q5 = referral_service.quote_referee_discount(b, 500)
        check("below the minimum, nothing", q5["amount"], 0.0)
        settings_service.set_many({"referral.referee_min_order": 0})

        # Someone with no referrer never gets it, in either mode.
        q6 = referral_service.quote_referee_discount(a, 500)
        check("an unreferred customer gets nothing", q6["amount"], 0.0)

        # A flagged relationship earns nothing until an admin approves.
        c = make_user("c", referred_by=a, flags=["same_device"])
        try:
            q7 = referral_service.quote_referee_discount(c, 500)
            check("flagged signup gets no discount", q7["amount"], 0.0)
            check("and is told it is being reviewed", "review" in (q7["reason"] or "").lower())
        finally:
            cleanup(c)

        # Switching off restores the one-time rule.
        head("Switching it back off")
        settings_service.set_many({"referral.referee_discount_every_order": False})
        q8 = referral_service.quote_referee_discount(b, 500)
        check("one-time rule returns", q8["amount"], 0.0)

    finally:
        try:
            settings_service.set_many({k: v for k, v in before.items() if v is not None})
            cleanup(a, b)
        except Exception as exc:
            print(f"  (teardown) {str(exc)[:80]}")
        finally:
            print(f"\n{'=' * 46}\n  {PASS} passed, {FAIL} failed\n{'=' * 46}\n")
            db.close_pool()

    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
