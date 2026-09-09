"""
Admin settings.

Everything the business can tune -- referral rewards, discount rates, the
coin-to-rupee rate, shipping thresholds -- is a row in admin_settings, not
a constant in this file. Read through here so nothing hardcodes a number
that an administrator is supposed to own.

Cached for a few seconds because settings are read on nearly every request
and written rarely. Any write clears the cache immediately, so the admin
panel never shows a stale value to the person who just changed it.
"""
import threading
import time

import db

_TTL_SECONDS = 15
_cache = {"at": 0.0, "values": {}}
_lock = threading.Lock()


def _load():
    rows = db.query("select key, value, is_public from admin_settings")
    return {r["key"]: {"value": r["value"], "is_public": r["is_public"]} for r in rows}


def _all():
    with _lock:
        if time.time() - _cache["at"] > _TTL_SECONDS or not _cache["values"]:
            _cache["values"] = _load()
            _cache["at"] = time.time()
        return _cache["values"]


def invalidate():
    with _lock:
        _cache["at"] = 0.0
        _cache["values"] = {}


def get(key, default=None):
    entry = _all().get(key)
    return default if entry is None else entry["value"]


def get_int(key, default=0):
    try:
        return int(get(key, default))
    except (TypeError, ValueError):
        return default


def get_float(key, default=0.0):
    try:
        return float(get(key, default))
    except (TypeError, ValueError):
        return default


def get_bool(key, default=False):
    value = get(key, default)
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def get_str(key, default=""):
    value = get(key, default)
    return default if value is None else str(value)


def public_settings():
    """The subset the storefront is allowed to see."""
    return {k: v["value"] for k, v in _all().items() if v["is_public"]}


def grouped(include_private=True):
    """Full descriptor list for the admin settings screens."""
    rows = db.query(
        """select key, value, value_type, group_key, label, description,
                  ui_control, options, min_value, max_value, is_public,
                  sort_order, updated_at
             from admin_settings
            where %s or is_public
            order by group_key, sort_order, key""",
        (include_private,),
    )
    out = {}
    for row in rows:
        out.setdefault(row["group_key"], []).append(row)
    return out


def set_many(updates, actor_id=None):
    """
    updates: {key: json-serialisable value}. Unknown keys are ignored
    rather than silently created, so a typo in the admin panel cannot
    invent a setting the code never reads.
    """
    if not updates:
        return 0

    known = set(_all().keys())
    changed = 0
    with db.transaction() as cur:
        for key, value in updates.items():
            if key not in known:
                continue
            import json

            cur.execute(
                """update admin_settings
                      set value = %s::jsonb, updated_by = %s, updated_at = now()
                    where key = %s""",
                (json.dumps(value), actor_id, key),
            )
            changed += cur.rowcount
    invalidate()
    return changed


# ---------------------------------------------------------------- bundles
def referral_config():
    """One read, so every caller sees a consistent snapshot of the rules."""
    return {
        "enabled": get_bool("referral.enabled", True),
        "referee_discount_type": get_str("referral.referee_discount_type", "percent"),
        "referee_discount_value": get_float("referral.referee_discount_value", 0),
        "referee_discount_max": get_float("referral.referee_discount_max", 0),
        "referee_min_order": get_float("referral.referee_min_order", 0),
        "referrer_points": get_int("referral.referrer_points", 0),
        "referee_welcome_points": get_int("referral.referee_welcome_points", 0),
        "qualify_on": get_str("referral.qualify_on", "order_paid"),
        "reward_hold_days": get_int("referral.reward_hold_days", 0),
        "max_rewards_per_user": get_int("referral.max_rewards_per_user", 0),
        "cookie_days": get_int("referral.cookie_days", 30),
        "block_same_ip": get_bool("referral.block_same_ip", True),
        "block_same_device": get_bool("referral.block_same_device", True),
        "auto_approve_flagged": get_bool("referral.auto_approve_flagged", False),
        "share_message": get_str("referral.share_message", ""),
    }


def wallet_config():
    return {
        "enabled": get_bool("wallet.enabled", True),
        "coin_name": get_str("wallet.coin_name", "Coins"),
        "coins_per_rupee": max(1.0, get_float("wallet.coins_per_rupee", 10)),
        "min_redeem_points": get_int("wallet.min_redeem_points", 0),
        "max_redeem_percent": get_float("wallet.max_redeem_percent", 100),
        "points_expiry_days": get_int("wallet.points_expiry_days", 0),
    }


def store_config():
    return {
        "name": get_str("store.name", "ZION Herbs"),
        "currency": get_str("store.currency", "INR"),
        "currency_symbol": get_str("store.currency_symbol", "₹"),
        "free_shipping_over": get_float("store.free_shipping_over", 0),
        "shipping_flat": get_float("store.shipping_flat", 0),
        "tax_percent": get_float("store.tax_percent", 0),
        "cod_enabled": get_bool("store.cod_enabled", True),
        "razorpay_enabled": get_bool("store.razorpay_enabled", False),
        "whatsapp_order_enabled": get_bool("store.whatsapp_order_enabled", True),
        "whatsapp": get_str("store.whatsapp", ""),
    }
