"""Referral link tracking, the referrer's dashboard, and the checkout quote."""
from flask import Blueprint, g, request

import db
from services import referral_service, settings_service
from utils.auth import login_required
from utils.helpers import client_ip, fail, hash_ip, ok, to_jsonable

bp = Blueprint("referral", __name__, url_prefix="/api/referral")


@bp.get("/preview/<code>")
def preview(code):
    """Who owns this link and what it is worth. Used by the /r/<code> page."""
    referrer = referral_service.resolve_code(code)
    if not referrer:
        return fail("That invitation link is not valid.", 404, code="unknown_code")

    cfg = settings_service.referral_config()
    return ok({
        "referrer_name": referrer["full_name"] or "A friend",
        "code": referrer["referral_code"],
        "discount_label": referral_service.describe_discount(cfg),
        "min_order": cfg["referee_min_order"],
        "enabled": cfg["enabled"],
    })


@bp.post("/track/<code>")
def track(code):
    """
    Log a click. Deliberately forgiving: an unknown code returns 200 with
    enabled=false rather than an error, because a broken link must never
    put an error page between a visitor and the shop.
    """
    data = request.get_json(silent=True) or {}
    result = referral_service.track_click(
        code,
        visitor_token=data.get("visitor_token"),
        ip_hash=hash_ip(client_ip()),
        user_agent=request.headers.get("User-Agent"),
        landing_path=data.get("landing_path"),
        referer=data.get("referer"),
        utm=data.get("utm") or {},
    )
    if not result:
        return ok({"enabled": False, "referrer_name": None, "discount_label": None})
    return ok(to_jsonable(result))


@bp.get("/me")
@login_required
def my_referrals():
    return ok(to_jsonable(referral_service.stats_for(g.user["id"])))


@bp.get("/quote")
@login_required
def quote():
    """The referred customer's first-order discount for a given subtotal."""
    try:
        subtotal = float(request.args.get("subtotal", 0))
    except ValueError:
        return fail("Subtotal must be a number.", 422)
    return ok(to_jsonable(referral_service.quote_referee_discount(g.user["id"], subtotal)))


@bp.get("/config")
def public_config():
    """What the storefront may say about the programme."""
    cfg = settings_service.referral_config()
    wallet = settings_service.wallet_config()
    return ok({
        "enabled": cfg["enabled"],
        "discount_label": referral_service.describe_discount(cfg),
        "min_order": cfg["referee_min_order"],
        "referrer_points": cfg["referrer_points"],
        "welcome_points": cfg["referee_welcome_points"],
        "share_message": cfg["share_message"],
        "coin_name": wallet["coin_name"],
        "coins_per_rupee": wallet["coins_per_rupee"],
    })
