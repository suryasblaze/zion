"""Password hashing, JWT issue/verify, and the route guards."""
from datetime import timedelta
from functools import wraps

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from flask import g, request

import db
from config import Config
from utils.helpers import fail, now

_hasher = PasswordHasher()


# --------------------------------------------------------------- passwords
def hash_password(password):
    return _hasher.hash(password)


def verify_password(stored_hash, password):
    try:
        _hasher.verify(stored_hash, password)
        return True
    except (VerifyMismatchError, InvalidHashError, TypeError):
        return False


def needs_rehash(stored_hash):
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return False


# -------------------------------------------------------------------- JWT
def issue_tokens(user):
    base = {"sub": str(user["id"]), "email": user["email"], "role": user["role"]}
    access = jwt.encode(
        {**base, "type": "access", "iat": now(), "exp": now() + timedelta(minutes=Config.JWT_ACCESS_TTL_MIN)},
        Config.JWT_SECRET,
        algorithm=Config.JWT_ALGO,
    )
    refresh = jwt.encode(
        {**base, "type": "refresh", "iat": now(), "exp": now() + timedelta(days=Config.JWT_REFRESH_TTL_DAYS)},
        Config.JWT_SECRET,
        algorithm=Config.JWT_ALGO,
    )
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer",
        "expires_in": Config.JWT_ACCESS_TTL_MIN * 60,
    }


def decode_token(token, expected_type="access"):
    payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGO])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Wrong token type")
    return payload


def _bearer():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


def _load_user(payload):
    return db.query_one(
        """select id, email, full_name, phone, role, referral_code, referred_by,
                  wallet_balance, is_active, created_at
             from users where id = %s""",
        (payload["sub"],),
    )


# ----------------------------------------------------------------- guards
def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _bearer()
        if not token:
            return fail("Sign in to continue.", 401, code="no_token")
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return fail("Your session has expired. Sign in again.", 401, code="token_expired")
        except jwt.InvalidTokenError:
            return fail("That session is not valid. Sign in again.", 401, code="token_invalid")

        user = _load_user(payload)
        if not user:
            return fail("That account no longer exists.", 401, code="user_missing")
        if not user["is_active"]:
            return fail("This account has been disabled. Contact support.", 403, code="user_disabled")

        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn):
    @wraps(fn)
    @login_required
    def wrapper(*args, **kwargs):
        if g.user["role"] not in ("admin", "staff"):
            return fail("You do not have access to this area.", 403, code="forbidden")
        return fn(*args, **kwargs)

    return wrapper


def optional_auth(fn):
    """Attaches g.user when a valid token is present, but never blocks."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        g.user = None
        token = _bearer()
        if token:
            try:
                g.user = _load_user(decode_token(token))
            except Exception:
                g.user = None
        return fn(*args, **kwargs)

    return wrapper
