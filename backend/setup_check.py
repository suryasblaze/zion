"""
Setup doctor.

    python setup_check.py

Run this after filling in .env and before anything else. It checks every
value the app needs, actually connects to the things it names, and tells
you what to fix rather than what went wrong.

Exit code 0 means you are ready to run `python seed.py`.
"""
import os
import re
import socket
import sys
from urllib.parse import urlparse

OK, WARN, BAD = "  ok  ", " warn ", " FIX  "
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
problems, warnings = [], []


def line(mark, text, hint=None):
    print(f"{mark}{text}")
    if hint:
        print(f"        {hint}")


def fix(text, hint):
    problems.append(text)
    line(BAD, text, hint)


def warn(text, hint):
    warnings.append(text)
    line(WARN, text, hint)


def good(text):
    line(OK, text)


print("\nZION Herbs - setup check\n" + "=" * 46)

# ---------------------------------------------------------------- .env
here = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(here, ".env")

if not os.path.exists(env_path):
    fix(".env is missing",
        f"Copy the template:  cp {os.path.join('backend', '.env.example')} {os.path.join('backend', '.env')}")
    print("\nNothing else can be checked until .env exists.\n")
    sys.exit(1)

good(".env found")

from dotenv import load_dotenv  # noqa: E402  (after the existence check)

load_dotenv(env_path)

# ------------------------------------------------------------ required
print("\nRequired settings\n" + "-" * 46)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
PEPPER = os.getenv("PRIVACY_PEPPER", "").strip()

# Whether the connection is worth attempting is a separate question from
# whether the rest of the settings are complete -- a missing pepper says
# nothing about the database, and you want the connection tested first.
db_url_ok = True

if not DATABASE_URL:
    fix("DATABASE_URL is empty",
        "Supabase: Project settings > Database > Connection string > URI (session pooler).")
    db_url_ok = False
elif "YOUR-PROJECT" in DATABASE_URL or "YOUR-REF" in DATABASE_URL or "PASSWORD" in DATABASE_URL:
    fix("DATABASE_URL still contains placeholder text",
        "Replace YOUR-REF and PASSWORD with the real values from Supabase.")
    db_url_ok = False
elif not DATABASE_URL.startswith(("postgresql://", "postgres://")):
    fix("DATABASE_URL does not look like a Postgres URI",
        "It should start with postgresql:// - copy the URI, not the psql command.")
    db_url_ok = False
else:
    good("DATABASE_URL is set")

for name, value in (("JWT_SECRET", JWT_SECRET), ("PRIVACY_PEPPER", PEPPER)):
    if not value:
        fix(f"{name} is empty",
            'Generate one:  python -c "import secrets; print(secrets.token_urlsafe(48))"')
    elif len(value) < 32:
        fix(f"{name} is too short ({len(value)} characters, needs 32+)",
            'Generate one:  python -c "import secrets; print(secrets.token_urlsafe(48))"')
    elif value.startswith("test-only") or "changeme" in value.lower():
        fix(f"{name} still looks like a placeholder",
            "Generate a real random value before going live.")
    else:
        good(f"{name} is set ({len(value)} characters)")

if JWT_SECRET and PEPPER and JWT_SECRET == PEPPER:
    fix("JWT_SECRET and PRIVACY_PEPPER are identical",
        "Use two different random values - they protect different things.")

# ------------------------------------------------------------- connect
print("\nDatabase\n" + "-" * 46)

if db_url_ok and DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    host, port = parsed.hostname, parsed.port or 5432

    try:
        socket.create_connection((host, port), timeout=8).close()
        good(f"{host}:{port} is reachable")
        reachable = True
    except OSError as exc:
        reachable = False
        fix(f"cannot reach {host}:{port} - {exc}",
            "Check the host and port. Supabase 'Direct connection' is IPv6-only on most "
            "plans -- use the Session pooler URI instead.")

    if reachable:
        try:
            import psycopg

            with psycopg.connect(DATABASE_URL, connect_timeout=12) as conn:
                with conn.cursor() as cur:
                    cur.execute("select version()")
                    version = cur.fetchone()[0].split(",")[0]
                    good(f"connected - {version}")

                    cur.execute("select current_user, current_database()")
                    user, dbname = cur.fetchone()
                    good(f"as {user} on {dbname}")

                    cur.execute("""
                        select count(*) from information_schema.tables
                         where table_schema = 'public'
                           and table_name in ('users','products','referrals',
                                              'wallet_transactions','admin_settings')
                    """)
                    found = cur.fetchone()[0]
                    if found == 0:
                        warn("schema is not installed yet",
                             "That is expected on a fresh project. Run:  python seed.py")
                    elif found < 5:
                        warn(f"only {found} of 5 core tables exist",
                             "Run:  python seed.py --migrate")
                    else:
                        good("schema is installed")
                        cur.execute("select count(*) from products")
                        n = cur.fetchone()[0]
                        cur.execute("select count(*) from users where role = 'admin'")
                        admins = cur.fetchone()[0]
                        good(f"{n} products, {admins} admin account(s)")
                        if admins == 0:
                            warn("no admin account yet",
                                 "Set ADMIN_EMAIL and ADMIN_PASSWORD, then:  python seed.py --admin")

                    cur.execute("select 1 from pg_extension where extname = 'pgcrypto'")
                    if not cur.fetchone():
                        warn("pgcrypto extension not installed",
                             "seed.py installs it. On Supabase it is available by default.")
        except ImportError:
            fix("psycopg is not installed",
                "Run:  pip install -r requirements.txt")
        except Exception as exc:
            msg = str(exc).strip().splitlines()[0]
            if "password authentication failed" in msg.lower():
                fix("the database rejected the password",
                    "Copy the connection string again from Supabase - the password is in the URI.")
            elif "does not exist" in msg.lower():
                fix(f"database error - {msg}", "Check the database name at the end of the URI.")
            else:
                fix(f"could not connect - {msg}", "Check DATABASE_URL.")
else:
    line(WARN, "skipped - DATABASE_URL is not usable yet")

# ------------------------------------------------------------ optional
print("\nOptional\n" + "-" * 46)

admin_email = os.getenv("ADMIN_EMAIL", "").strip()
admin_pw = os.getenv("ADMIN_PASSWORD", "")
if not admin_email or not admin_pw:
    warn("ADMIN_EMAIL / ADMIN_PASSWORD not set",
         "Needed once, so seed.py can create your admin login.")
else:
    # seed.py will happily store whatever is here, but the login endpoint
    # validates the address format -- so a non-email locks you out with a
    # generic "email and password do not match" and no clue why.
    if not EMAIL_RE.match(admin_email):
        fix(f"ADMIN_EMAIL is not an email address ({admin_email!r})",
            "Sign-in validates the format, so you would not be able to log in. "
            "Use something like you@yourdomain.com.")
    if len(admin_pw) < 10:
        fix(f"ADMIN_PASSWORD is {len(admin_pw)} characters, needs 10 or more",
            "seed.py will refuse it.")
    elif EMAIL_RE.match(admin_email):
        good(f"admin account will be {admin_email}")

sb_url = os.getenv("SUPABASE_URL", "").strip()
sb_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
if sb_url and sb_key:
    if "YOUR-PROJECT" in sb_url:
        warn("SUPABASE_URL still has placeholder text", "Image uploads will not work.")
    else:
        good("Supabase Storage configured (image uploads enabled)")
else:
    warn("Supabase Storage not configured",
         "Image fields will accept URLs but you cannot upload files from the admin panel. "
         "Set SUPABASE_URL and SUPABASE_SERVICE_KEY to enable it.")

rp_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
rp_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
rp_hook = os.getenv("RAZORPAY_WEBHOOK_SECRET", "").strip()
if rp_id and rp_secret:
    good("Razorpay keys present")
    if not rp_hook:
        warn("RAZORPAY_WEBHOOK_SECRET is empty",
             "Without it, payments confirm only on the browser callback. "
             "Set it in the Razorpay dashboard under Webhooks.")
    if rp_id.startswith("rzp_test"):
        line(OK, "using Razorpay TEST keys")
else:
    warn("Razorpay not configured",
         "Cash on delivery and WhatsApp ordering still work. Add keys to take card payments.")

cors = os.getenv("CORS_ORIGINS", "")
if cors:
    good(f"CORS allows: {cors}")
else:
    warn("CORS_ORIGINS not set", "Defaults to http://localhost:5173.")

# -------------------------------------------------------------- verdict
print("\n" + "=" * 46)
if problems:
    print(f"  {len(problems)} thing(s) to fix before this will run:\n")
    for p in problems:
        print(f"    - {p}")
    print()
    sys.exit(1)

print("  Ready.")
if warnings:
    print(f"  {len(warnings)} optional item(s) not configured - fine for now.")
print("\n  Next:  python seed.py     then     python app.py\n")
sys.exit(0)
