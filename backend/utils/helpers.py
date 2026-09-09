"""Response envelopes, hashing, codes, and small shared utilities."""
import hashlib
import random
import re
import secrets
import string
import unicodedata
from datetime import datetime, timezone
from decimal import Decimal

from flask import jsonify, request

from config import Config

# --------------------------------------------------------------- envelope
def ok(data=None, message=None, status=200, **extra):
    body = {"success": True}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    body.update(extra)
    return jsonify(body), status


def fail(message, status=400, code=None, errors=None):
    body = {"success": False, "message": message}
    if code:
        body["code"] = code
    if errors:
        body["errors"] = errors
    return jsonify(body), status


# ------------------------------------------------------------------ money
def money(value):
    """Round half-up to paise and hand back a float the JSON layer likes."""
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(Decimal("0.01")))


def to_jsonable(value):
    """Decimals and datetimes come back from psycopg; JSON does not want them."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(v) for v in value]
    return value


def now():
    return datetime.now(timezone.utc)


# ----------------------------------------------------------------- privacy
def hash_ip(ip):
    """
    IPs are personal data. We only ever need to answer 'is this the same
    network as before', so we store a salted digest and never the address.
    """
    if not ip:
        return None
    return hashlib.sha256(f"{ip}|{Config.PRIVACY_PEPPER}".encode()).hexdigest()


def client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr


def hash_device(device_id):
    if not device_id:
        return None
    return hashlib.sha256(f"{device_id}|{Config.PRIVACY_PEPPER}".encode()).hexdigest()


# ------------------------------------------------------------------- codes
# No 0/O/1/I/L -- these get read aloud and typed by hand.
_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def generate_referral_code(name="", length=6):
    """
    'PRIYA-K7M2Q' reads better than a raw token and is far easier to share
    over the phone. Uniqueness is still enforced by the database.
    """
    prefix = ""
    if name:
        letters = re.sub(r"[^A-Za-z]", "", unicodedata.normalize("NFKD", name))
        if len(letters) >= 3:
            prefix = letters[:5].upper() + "-"
    body = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))
    return f"{prefix}{body}"


def generate_order_number():
    stamp = now().strftime("%y%m")
    tail = "".join(secrets.choice(string.digits) for _ in range(5))
    return f"ZION-{stamp}-{tail}"


def slugify(text, fallback="item"):
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[-\s]+", "-", text)
    return text or fallback


# -------------------------------------------------------------- validation
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def valid_email(value):
    return bool(value and _EMAIL_RE.match(value.strip()))


def valid_phone(value):
    if not value:
        return True  # optional
    digits = re.sub(r"\D", "", value)
    return 10 <= len(digits) <= 15


def password_problems(password):
    """Returns a list of reasons the password is unacceptable."""
    problems = []
    if not password or len(password) < 8:
        problems.append("Use at least 8 characters.")
    if password and not re.search(r"[A-Za-z]", password):
        problems.append("Include at least one letter.")
    if password and not re.search(r"\d", password):
        problems.append("Include at least one number.")
    return problems


def paginate_args(default_limit=24, max_limit=100):
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    try:
        limit = int(request.args.get("limit", default_limit))
    except ValueError:
        limit = default_limit
    limit = max(1, min(limit, max_limit))
    return page, limit, (page - 1) * limit
