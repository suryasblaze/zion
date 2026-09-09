"""
Scheduled maintenance. Run daily.

    python maintenance.py              everything
    python maintenance.py --rewards    pay referral rewards past their hold
    python maintenance.py --expire     expire stale wallet points
    python maintenance.py --dry-run    report only, change nothing

Windows Task Scheduler, cron, or a Supabase scheduled function can all
call this. Every action is idempotent, so a double-run is harmless.
"""
import sys
from datetime import timedelta

import db
from config import Config
from services import referral_service, settings_service, wallet_service
from utils.helpers import now

DRY = "--dry-run" in sys.argv


def log(text):
    print(f"  {text}")


def pay_due_rewards():
    """Referrals whose hold period has elapsed."""
    print("\nReferral rewards past their hold")
    cfg = settings_service.referral_config()

    if not cfg["enabled"]:
        return log("programme is off - nothing to do")
    if cfg["reward_hold_days"] <= 0:
        return log("no hold configured - rewards pay immediately, nothing to do")

    cutoff = now() - timedelta(days=cfg["reward_hold_days"])
    due = db.query(
        """select r.id, r.referrer_points_config, u.email
             from referrals r join users u on u.id = r.referrer_id
            where r.status = 'qualified'
              and r.qualified_at <= %s
              and (r.fraud_flags = '[]'::jsonb or %s)""",
        (cutoff, cfg["auto_approve_flagged"]),
    )
    if not due:
        return log("nothing due")

    log(f"{len(due)} due")
    if DRY:
        for row in due:
            log(f"  would pay {row['referrer_points_config']} to {row['email']}")
        return

    result = referral_service.process_due_rewards()
    log(f"paid {result['paid']}")


def expire_points():
    """
    Expire points that have sat unused past the configured window.

    Expiry is measured from the customer's last wallet activity, not from
    each individual credit: someone who is still earning and spending is
    an active customer, and clawing back their oldest points would be
    both unkind and hard to explain.
    """
    print("\nWallet expiry")
    cfg = settings_service.wallet_config()

    if not cfg["enabled"]:
        return log("wallet is off - nothing to do")
    days = cfg["points_expiry_days"]
    if days <= 0:
        return log("expiry disabled (0 days) - nothing to do")

    cutoff = now() - timedelta(days=days)
    stale = db.query(
        """select u.id, u.email, u.wallet_balance,
                  max(t.created_at) as last_activity
             from users u
             join wallet_transactions t on t.user_id = u.id
            where u.wallet_balance > 0
            group by u.id
           having max(t.created_at) <= %s""",
        (cutoff,),
    )
    if not stale:
        return log(f"nobody has been inactive for {days} days")

    log(f"{len(stale)} account(s) inactive for over {days} days")
    total = 0
    for row in stale:
        if DRY:
            log(f"  would expire {row['wallet_balance']:,} from {row['email']}")
            total += row["wallet_balance"]
            continue
        try:
            with db.transaction() as cur:
                # Re-read under the lock: the balance may have moved since
                # the report above was taken.
                cur.execute("select wallet_balance from users where id = %s for update",
                            (row["id"],))
                current = (cur.fetchone() or {}).get("wallet_balance", 0)
                if current <= 0:
                    continue
                wallet_service.move(
                    cur, row["id"], -current, "admin_debit",
                    reference_type="manual",
                    idempotency_key=f"expiry:{row['id']}:{now():%Y-%m}",
                    note=f"Points expired after {days} days of inactivity",
                )
                total += current
                log(f"  expired {current:,} from {row['email']}")
        except Exception as exc:
            log(f"  skipped {row['email']} - {exc}")

    log(f"{'would expire' if DRY else 'expired'} {total:,} points in total")


def main():
    Config.validate()
    db.init_pool()
    args = set(sys.argv[1:])
    only = args & {"--rewards", "--expire"}

    print("ZION maintenance" + ("  (dry run)" if DRY else ""))
    try:
        if not only or "--rewards" in args:
            pay_due_rewards()
        if not only or "--expire" in args:
            expire_points()
        print("\nDone.\n")
    finally:
        db.close_pool()


if __name__ == "__main__":
    main()
