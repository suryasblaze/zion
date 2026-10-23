"""Runtime configuration, read once from the environment."""
import os
from dotenv import load_dotenv

load_dotenv()


def _int(key, default):
    try:
        return int(os.getenv(key, default))
    except (TypeError, ValueError):
        return int(default)


def _site_url(key, default):
    """
    A single site URL, tolerant of a comma-separated value.

    Returns the first https entry when there are several, else the first
    one. Recorded on the class so setup_check can tell you the .env
    needs fixing rather than silently papering over it forever.
    """
    raw = (os.getenv(key) or default).strip()
    if "," not in raw:
        return raw.rstrip("/")

    parts = [p.strip().rstrip("/") for p in raw.split(",") if p.strip()]
    chosen = next((p for p in parts if p.startswith("https://")), parts[0] if parts else default)
    _site_url.warning = (
        f"{key} holds {len(parts)} comma-separated values; using {chosen}. "
        f"Set it to one address -- CORS_ORIGINS is the setting that takes a list."
    )
    return chosen


_site_url.warning = None


def _bool(key, default=False):
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


class Config:
    ENV = os.getenv("FLASK_ENV", "production")
    DEBUG = ENV == "development"
    PORT = _int("PORT", 5000)

    CORS_ORIGINS = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()
    ]

    DATABASE_URL = os.getenv("DATABASE_URL", "")

    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "zion-media")

    JWT_SECRET = os.getenv("JWT_SECRET", "")
    JWT_ALGO = "HS256"
    JWT_ACCESS_TTL_MIN = _int("JWT_ACCESS_TTL_MIN", 45)
    JWT_REFRESH_TTL_DAYS = _int("JWT_REFRESH_TTL_DAYS", 30)

    PRIVACY_PEPPER = os.getenv("PRIVACY_PEPPER", "")

    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    # One address, not a list. CORS_ORIGINS above takes several, and the
    # two sit next to each other in .env, so a comma-separated value
    # pasted into the wrong one is an easy mistake -- and a quiet one:
    # every reset link, sitemap URL and email footer would be built from
    # "http://localhost:5173,https://zionherbs.com", which is not a URL
    # at all. Prefer the https entry, because the production address is
    # what these are for.
    PUBLIC_SITE_URL = _site_url("PUBLIC_SITE_URL", "http://localhost:5173")

    # ------------------------------------------------------------ mail
    # All optional. With SMTP_HOST unset the shop runs exactly as it did
    # before mail existed: sends are recorded as 'skipped' and nothing
    # is attempted. Turning it on is configuration, not a deploy.
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = _int("SMTP_PORT", 587)
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    # 587 wants STARTTLS; 465 is TLS from the first byte. Defaulted from
    # the port so the common cases need no extra setting.
    SMTP_SSL = _bool("SMTP_SSL", _int("SMTP_PORT", 587) == 465)
    SMTP_STARTTLS = _bool("SMTP_STARTTLS", _int("SMTP_PORT", 587) != 465)

    MAIL_FROM = os.getenv("MAIL_FROM", "")
    MAIL_REPLY_TO = os.getenv("MAIL_REPLY_TO", "")
    # Used for the Message-ID domain. A mismatch here is a small spam
    # signal, so it follows the public site unless told otherwise.
    MAIL_DOMAIN = os.getenv(
        "MAIL_DOMAIN",
        PUBLIC_SITE_URL.split("//")[-1].split("/")[0].split(":")[0] or "",
    )

    # How long a reset link lives. Short enough that a forwarded or
    # leaked mail stops working quickly, long enough to survive someone
    # reading it after lunch.
    PASSWORD_RESET_TTL_MIN = _int("PASSWORD_RESET_TTL_MIN", 60)

    # How long before the same account can be sent another reset link.
    # Short enough that someone whose first mail went to spam is not
    # stuck, long enough that the form cannot be used to flood a mailbox.
    PASSWORD_RESET_COOLDOWN_MIN = _int("PASSWORD_RESET_COOLDOWN_MIN", 2)

    @classmethod
    def validate(cls):
        """Fail loudly at boot rather than mysteriously at request time."""
        missing = [
            name
            for name in ("DATABASE_URL", "JWT_SECRET", "PRIVACY_PEPPER")
            if not getattr(cls, name)
        ]
        if missing:
            raise RuntimeError(
                "Missing required environment variables: "
                + ", ".join(missing)
                + ". Copy backend/.env.example to backend/.env and fill them in."
            )
        if len(cls.JWT_SECRET) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters.")
