"""
Set up the database.

    python seed.py            run migrations, then load the seed data
    python seed.py --migrate  migrations only
    python seed.py --admin    create or reset the admin account
    python seed.py --reset    DROP every table first, then rebuild

Every step is safe to re-run: migrations use "if not exists", seed data is
keyed on natural keys, and --admin updates an existing account rather than
failing on the duplicate email.
"""
import os
import sys

import db
from config import Config
from utils.auth import hash_password
from utils.helpers import generate_referral_code

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS = os.path.join(ROOT, "db", "migrations")
SEEDS = [os.path.join(ROOT, "db", "seed.sql"),
         os.path.join(ROOT, "db", "seed_products.sql")]


def run_file(path):
    with open(path, encoding="utf-8") as fh:
        sql_text = fh.read()
    with db.transaction() as cur:
        cur.execute(sql_text)
    print(f"  ok  {os.path.basename(path)}")


def migrate():
    print("Running migrations")
    for name in sorted(os.listdir(MIGRATIONS)):
        if name.endswith(".sql"):
            run_file(os.path.join(MIGRATIONS, name))


def seed():
    print("Loading seed data")
    for path in SEEDS:
        run_file(path)


def reset():
    confirm = os.getenv("CONFIRM_RESET") or input(
        "This DROPS every ZION table and all its data. Type 'drop' to continue: "
    )
    if confirm.strip().lower() != "drop":
        print("Cancelled. Nothing was changed.")
        sys.exit(1)

    print("Dropping schema")
    with db.transaction() as cur:
        cur.execute("drop schema public cascade; create schema public;")
        cur.execute("grant all on schema public to public;")
    print("  ok  schema recreated")


def make_admin():
    email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or ""
    name = os.getenv("ADMIN_NAME") or "ZION Admin"

    if not email or not password:
        print("\nSet ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env, then run:")
        print("  python seed.py --admin")
        return
    if len(password) < 10:
        print("ADMIN_PASSWORD must be at least 10 characters.")
        sys.exit(1)

    existing = db.query_one("select id, referral_code from users where email = %s", (email,))
    if existing:
        db.execute(
            "update users set password_hash = %s, role = 'admin', is_active = true, full_name = %s"
            " where id = %s",
            (hash_password(password), name, existing["id"]),
        )
        print(f"  ok  admin password reset for {email}")
    else:
        db.execute(
            """insert into users (email, password_hash, full_name, role, referral_code,
                                  email_verified)
               values (%s,%s,%s,'admin',%s,true)""",
            (email, hash_password(password), name, generate_referral_code(name)),
        )
        print(f"  ok  admin created: {email}")

    print("\n  Sign in at  http://localhost:5173/signin")
    print("  Admin panel http://localhost:5173/admin")


def main():
    args = set(sys.argv[1:])
    Config.validate()
    db.init_pool()

    try:
        if "--reset" in args:
            reset()
            migrate()
            seed()
            make_admin()
        elif "--migrate" in args:
            migrate()
        elif "--admin" in args:
            make_admin()
        else:
            migrate()
            seed()
            make_admin()

        counts = db.query_one(
            """select (select count(*) from products) as products,
                      (select count(*) from product_variants) as variants,
                      (select count(*) from admin_settings) as settings,
                      (select count(*) from faqs) as faqs,
                      (select count(*) from users) as users"""
        )
        print("\nDatabase ready:")
        for key, value in counts.items():
            print(f"  {value:>4}  {key}")
    finally:
        db.close_pool()


if __name__ == "__main__":
    main()
