"""Runtime configuration, read once from the environment."""
import os
from dotenv import load_dotenv

load_dotenv()


def _int(key, default):
    try:
        return int(os.getenv(key, default))
    except (TypeError, ValueError):
        return int(default)


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

    PUBLIC_SITE_URL = os.getenv("PUBLIC_SITE_URL", "http://localhost:5173").rstrip("/")

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
