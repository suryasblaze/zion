"""Registration, sign-in, session. Referral attribution happens here."""
from flask import Blueprint, g, request

import db
from services import referral_service, settings_service
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
