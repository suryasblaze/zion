"""Registration, sign-in, session. Referral attribution happens here."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, request

import db
from config import Config
from services import email_templates, mail_service, referral_service, settings_service
from utils.auth import (admin_required, hash_password, issue_tokens, login_required,
                        verify_password)
from utils.helpers import (client_ip, fail, generate_referral_code, hash_device, hash_ip, ok,
                           password_problems, to_jsonable, valid_email, valid_phone)

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

PUBLIC_FIELDS = """id, email, full_name, phone, role, referral_code,
                   referred_by, wallet_balance, created_at"""


@bp.post("/register")
def register():
    """
    Public registration, off by default.

    Accounts are made by an admin in the panel, so this stays shut unless
    someone deliberately opens it. Worth knowing before you do: the
    referral programme acquires referees here and nowhere else, so with
    this closed a referral link has nobody to convert.
    """
    if not settings_service.get_bool("auth.public_signup", False):
        return fail(
            "New accounts are created by ZION. Ask us and we will set one up for you.",
            403, code="signup_closed",
        )

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip() or None

    errors = {}
    if not valid_email(email):
        errors["email"] = "Enter a valid email address."
    if not full_name:
        errors["full_name"] = "Tell us your name."
    if not valid_phone(phone):
        errors["phone"] = "Enter a valid phone number, or leave it blank."
    problems = password_problems(password)
    if problems:
        errors["password"] = " ".join(problems)
    if errors:
        return fail("Check the highlighted fields.", 422, errors=errors)

    if db.scalar("select 1 from users where email = %s", (email,)):
        return fail("An account with that email already exists. Sign in instead.", 409,
                    code="email_taken")

    ip_hash = hash_ip(client_ip())
    device_hash = hash_device(data.get("device_id"))
    referral_code = (data.get("referral_code") or "").strip().upper() or None
    visitor_token = data.get("visitor_token")

    # One transaction: the account, its referral link, and the welcome
    # points either all exist afterwards, or none of them do.
    with db.transaction() as cur:
        own_code = generate_referral_code(full_name)
        for _ in range(5):
            cur.execute("select 1 from users where referral_code = %s", (own_code,))
            if not cur.fetchone():
                break
            own_code = generate_referral_code(full_name)

        cur.execute(
            f"""insert into users
                  (email, password_hash, full_name, phone, referral_code,
                   signup_ip_hash, signup_device_id, marketing_opt_in)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                returning {PUBLIC_FIELDS}""",
            (email, hash_password(password), full_name, phone, own_code,
             ip_hash, device_hash, bool(data.get("marketing_opt_in"))),
        )
        user = cur.fetchone()

        referral = None
        if referral_code:
            try:
                referral = referral_service.attach_referral(
                    cur, user, referral_code, visitor_token, ip_hash, device_hash
                )
            except Exception:
                # A bad or abusive code must not cost someone their account.
                referral = None

        if referral and referral.get("welcome_points"):
            cur.execute("select wallet_balance from users where id = %s", (user["id"],))
            user["wallet_balance"] = cur.fetchone()["wallet_balance"]

    tokens = issue_tokens(user)
    return ok(
        {**tokens, "user": to_jsonable(user), "referral": to_jsonable(referral)},
        message=f"Welcome to ZION, {full_name.split(' ')[0]}.",
        status=201,
    )


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = db.query_one(
        f"select {PUBLIC_FIELDS}, password_hash, is_active from users where email = %s",
        (email,),
    )
    # Same message either way -- never confirm whether an email is registered.
    if not user or not verify_password(user["password_hash"], password):
        return fail("That email and password do not match.", 401, code="bad_credentials")
    if not user["is_active"]:
        return fail("This account has been disabled. Contact support.", 403)

    db.execute("update users set last_login_at = now() where id = %s", (user["id"],))
    user.pop("password_hash", None)
    user.pop("is_active", None)

    return ok({**issue_tokens(user), "user": to_jsonable(user)},
              message=f"Welcome back, {(user['full_name'] or 'there').split(' ')[0]}.")


@bp.post("/refresh")
def refresh():
    import jwt as pyjwt
    from utils.auth import decode_token

    data = request.get_json(silent=True) or {}
    token = data.get("refresh_token")
    if not token:
        return fail("No refresh token supplied.", 400)
    try:
        payload = decode_token(token, expected_type="refresh")
    except pyjwt.PyJWTError:
        return fail("That session has expired. Sign in again.", 401)

    user = db.query_one(f"select {PUBLIC_FIELDS} from users where id = %s and is_active",
                        (payload["sub"],))
    if not user:
        return fail("That account is no longer active.", 401)
    return ok({**issue_tokens(user), "user": to_jsonable(user)})


@bp.get("/me")
@login_required
def me():
    return ok(to_jsonable(g.user))


@bp.patch("/me")
@login_required
def update_me():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or g.user["full_name"]).strip()
    phone = (data.get("phone") or "").strip() or None

    if not valid_phone(phone):
        return fail("Enter a valid phone number.", 422, errors={"phone": "Not a valid number."})

    row = db.insert_returning(
        f"""update users set full_name = %s, phone = %s,
                             marketing_opt_in = coalesce(%s, marketing_opt_in)
             where id = %s returning {PUBLIC_FIELDS}""",
        (full_name, phone, data.get("marketing_opt_in"), g.user["id"]),
    )
    return ok(to_jsonable(row), message="Profile updated.")


@bp.post("/password")
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new = data.get("new_password") or ""

    stored = db.scalar("select password_hash from users where id = %s", (g.user["id"],))
    if not verify_password(stored, current):
        return fail("Your current password is not right.", 403,
                    errors={"current_password": "Does not match."})

    problems = password_problems(new)
    if problems:
        return fail("Choose a stronger password.", 422,
                    errors={"new_password": " ".join(problems)})

    db.execute("update users set password_hash = %s where id = %s",
               (hash_password(new), g.user["id"]))
    return ok(message="Password changed.")


# =====================================================================
# Forgotten passwords
#
# The shape of these two endpoints matters as much as what they do.
#
# /password/forgot answers the same way whether or not the address has
# an account. Anything else turns the form into a way to ask "does this
# person shop here" and get a reliable answer, which is a privacy leak
# before it is a security one.
#
# The token is random, single-use and short-lived, and only its sha256
# is stored, so the table is worthless to anyone who reads it.
# =====================================================================

# Deliberately vague, and identical in both branches.
_FORGOT_REPLY = ("If that address has an account, a reset link is on its way. "
                 "Check your spam folder if it does not arrive in a few minutes.")


def _hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


@bp.post("/password/forgot")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not valid_email(email):
        return fail("Enter a valid email address.", 422,
                    errors={"email": "Enter a valid email address."})

    user = db.query_one(
        "select id, email, full_name from users where email = %s", (email,))

    # No account: stop here, but say exactly what we say on success.
    if not user:
        return ok(message=_FORGOT_REPLY)

    # One live link at a time. Issuing a second without retiring the
    # first leaves two working keys to the same door, and the older one
    # is the one more likely to have been seen by someone else.
    db.execute(
        """update password_resets
              set used_at = now()
            where user_id = %s and used_at is null and expires_at > now()""",
        (user["id"],),
    )

    token = secrets.token_urlsafe(32)
    minutes = Config.PASSWORD_RESET_TTL_MIN
    expires = datetime.now(timezone.utc) + timedelta(minutes=minutes)

    db.execute(
        """insert into password_resets (user_id, token_hash, expires_at, requested_ip)
           values (%s, %s, %s, %s)""",
        (user["id"], _hash_token(token), expires, hash_ip(client_ip())),
    )

    link = f"{Config.PUBLIC_SITE_URL}/reset-password?token={token}"
    subject, text, html = email_templates.password_reset(
        user["full_name"], link, minutes)

    mail_service.send(
        user["email"], subject, text, html,
        template="password_reset",
        reference_type="user",
        reference_id=str(user["id"]),
    )

    return ok(message=_FORGOT_REPLY)


@bp.get("/password/reset/<token>")
def check_reset_token(token):
    """
    Lets the page say "this link has expired" before someone types a new
    password twice, rather than after.
    """
    row = db.query_one(
        """select pr.id, pr.used_at, pr.expires_at, u.email
             from password_resets pr
             join users u on u.id = pr.user_id
            where pr.token_hash = %s""",
        (_hash_token(token or ""),),
    )
    if not row or row["used_at"] or row["expires_at"] <= datetime.now(timezone.utc):
        return fail("That reset link has expired or has already been used.", 410,
                    code="reset_invalid")

    # Enough to reassure someone they are resetting the right account,
    # not enough to be worth harvesting.
    masked = row["email"].split("@")
    hint = f"{masked[0][:2]}{'*' * max(1, len(masked[0]) - 2)}@{masked[1]}"
    return ok({"email_hint": hint})


@bp.post("/password/reset")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    new = data.get("password") or ""

    problems = password_problems(new)
    if problems:
        return fail("Choose a stronger password.", 422,
                    errors={"password": " ".join(problems)})

    # Claim the token and change the password together. Two statements
    # with a gap between them is two chances for a link to be spent
    # twice by someone clicking twice.
    with db.transaction() as cur:
        cur.execute(
            """select id, user_id from password_resets
                where token_hash = %s
                  and used_at is null
                  and expires_at > now()
                for update""",
            (_hash_token(token),),
        )
        row = cur.fetchone()
        if not row:
            return fail("That reset link has expired or has already been used.", 410,
                        code="reset_invalid")

        cur.execute("update password_resets set used_at = now() where id = %s", (row["id"],))
        cur.execute("update users set password_hash = %s where id = %s",
                    (hash_password(new), row["user_id"]))

        # Any other link outstanding for this account dies with it: if
        # someone requested several, finishing one should not leave the
        # rest usable.
        cur.execute(
            """update password_resets
                  set used_at = now()
                where user_id = %s and used_at is null""",
            (row["user_id"],),
        )

    return ok(message="Your password has been changed. You can sign in now.")
