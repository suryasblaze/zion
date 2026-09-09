"""
Razorpay.

Two paths confirm a payment, and both land on the same idempotent
function:

  * the browser callback, after Razorpay's checkout closes, and
  * the server-to-server webhook, which is the one that must be trusted.

The browser callback can be forged, so its signature is verified with the
key secret before it is believed. The webhook carries its own signature
over the raw body; the raw body is what gets hashed, never the re-encoded
JSON, because re-encoding changes bytes and breaks the digest.

Marking an order paid is what releases the referrer's reward, so both
paths go through order_paid() rather than writing the order directly.
"""
import hashlib
import hmac
import json

import requests
from flask import Blueprint, g, request

import db
from config import Config
from services import referral_service, settings_service
from utils.auth import login_required
from utils.helpers import fail, money, ok, to_jsonable

bp = Blueprint("payments", __name__, url_prefix="/api/payments")

RAZORPAY_API = "https://api.razorpay.com/v1"


def _configured():
    return bool(Config.RAZORPAY_KEY_ID and Config.RAZORPAY_KEY_SECRET)


def _sign(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def _mark_paid(order_id, payment_ref, note):
    """
    Move an order to paid and let the referral engine decide what that
    means. Safe to call repeatedly: the update is conditional, and the
    reward itself carries an idempotency key.
    """
    row = db.insert_returning(
        """update orders
              set payment_status = 'paid',
                  status = case when status = 'pending' then 'confirmed' else status end,
                  payment_ref = coalesce(payment_ref, %s),
                  paid_at = coalesce(paid_at, now())
            where id = %s and payment_status <> 'refunded'
            returning id, order_number, payment_status""",
        (payment_ref, order_id),
    )
    if not row:
        return None

    db.execute(
        "insert into order_events (order_id, status, note) values (%s, 'confirmed', %s)",
        (order_id, note),
    )
    reward = referral_service.on_order_paid(order_id)
    return {"order": row, "referral": reward}


# =====================================================================
@bp.post("/razorpay/order")
@login_required
def create_order():
    """
    Open a Razorpay order for an order we have already written. The amount
    comes from our database, never from the request, so a tampered client
    cannot pay less than the order is worth.
    """
    if not _configured():
        return fail("Card payments are not switched on.", 503, code="razorpay_unconfigured")
    if not settings_service.store_config()["razorpay_enabled"]:
        return fail("Card payments are currently disabled.", 503, code="razorpay_disabled")

    data = request.get_json(silent=True) or {}
    order_number = (data.get("order_number") or "").strip()

    row = db.query_one(
        """select id, order_number, total, currency, email, phone, payment_status
             from orders where order_number = %s and user_id = %s""",
        (order_number, g.user["id"]),
    )
    if not row:
        return fail("We could not find that order.", 404)
    if row["payment_status"] == "paid":
        return fail("That order is already paid.", 409, code="already_paid")

    try:
        res = requests.post(
            f"{RAZORPAY_API}/orders",
            auth=(Config.RAZORPAY_KEY_ID, Config.RAZORPAY_KEY_SECRET),
            json={
                # Razorpay works in the smallest currency unit.
                "amount": int(round(float(row["total"]) * 100)),
                "currency": row["currency"] or "INR",
                "receipt": row["order_number"],
                "notes": {"order_id": str(row["id"]), "order_number": row["order_number"]},
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        return fail("Could not reach the payment provider. Try again.", 502,
                    code="gateway_unreachable")

    if res.status_code >= 400:
        detail = (res.json().get("error") or {}).get("description", "")
        return fail(f"The payment provider refused the request. {detail}".strip(), 502,
                    code="gateway_error")

    rp = res.json()
    db.execute("update orders set payment_ref = %s where id = %s", (rp["id"], row["id"]))

    return ok({
        "key_id": Config.RAZORPAY_KEY_ID,
        "razorpay_order_id": rp["id"],
        "amount": rp["amount"],
        "currency": rp["currency"],
        "order_number": row["order_number"],
        "prefill": {"email": row["email"], "contact": row["phone"] or ""},
        "name": settings_service.get_str("store.name", "ZION Herbs"),
    })


@bp.post("/razorpay/verify")
@login_required
def verify():
    """
    The browser callback. Confirms the signature Razorpay hands the page,
    so a customer cannot simply POST 'I paid'.
    """
    if not _configured():
        return fail("Card payments are not switched on.", 503)

    data = request.get_json(silent=True) or {}
    rp_order = data.get("razorpay_order_id") or ""
    rp_payment = data.get("razorpay_payment_id") or ""
    signature = data.get("razorpay_signature") or ""

    if not (rp_order and rp_payment and signature):
        return fail("That payment confirmation is incomplete.", 422)

    expected = _sign(f"{rp_order}|{rp_payment}".encode(), Config.RAZORPAY_KEY_SECRET)
    if not hmac.compare_digest(expected, signature):
        return fail("That payment could not be verified.", 400, code="bad_signature")

    row = db.query_one(
        "select id, order_number from orders where payment_ref = %s and user_id = %s",
        (rp_order, g.user["id"]),
    )
    if not row:
        return fail("We could not match that payment to an order.", 404)

    result = _mark_paid(row["id"], rp_payment, "Paid by card, confirmed in the browser")
    return ok(to_jsonable(result), message="Payment received.")


@bp.post("/razorpay/webhook")
def webhook():
    """
    The authoritative path. Razorpay retries this until it gets a 2xx, so
    it must be idempotent -- which it is, because the reward carries an
    idempotency key and the order update is conditional.
    """
    secret = Config.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        # Answer 200 so Razorpay stops retrying into a void, but record it.
        return ok(message="Webhook secret not configured; ignoring.", status=200)

    raw = request.get_data()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not hmac.compare_digest(_sign(raw, secret), signature):
        return fail("Signature mismatch.", 400, code="bad_signature")

    try:
        event = json.loads(raw or b"{}")
    except ValueError:
        return fail("Malformed payload.", 400)

    kind = event.get("event", "")
    payload = event.get("payload") or {}
    entity = (payload.get("payment") or {}).get("entity") or {}
    rp_order = entity.get("order_id")
    rp_payment = entity.get("id")

    if not rp_order:
        return ok(message=f"Ignored {kind}.")

    row = db.query_one("select id, order_number from orders where payment_ref = %s", (rp_order,))
    if not row:
        # An order we do not know about. 200 so it is not retried forever.
        return ok(message="No matching order.")

    if kind in ("payment.captured", "order.paid"):
        result = _mark_paid(row["id"], rp_payment, f"Paid by card ({kind})")
        return ok(to_jsonable(result), message="Recorded.")

    if kind == "payment.failed":
        db.execute(
            """update orders set payment_status = 'failed'
                where id = %s and payment_status = 'unpaid'""",
            (row["id"],),
        )
        db.execute(
            "insert into order_events (order_id, status, note) values (%s, 'pending', %s)",
            (row["id"], "Card payment failed"),
        )
        return ok(message="Recorded.")

    if kind.startswith("refund."):
        db.execute("update orders set payment_status = 'refunded' where id = %s", (row["id"],))
        referral_service.on_order_reversed(row["id"], "Payment refunded")
        return ok(message="Refund recorded.")

    return ok(message=f"Ignored {kind}.")


@bp.get("/methods")
def methods():
    """What the checkout should offer."""
    store = settings_service.store_config()
    return ok({
        "cod": store["cod_enabled"],
        "razorpay": store["razorpay_enabled"] and _configured(),
        "whatsapp": store["whatsapp_order_enabled"],
        "whatsapp_number": store["whatsapp"],
        "currency": store["currency"],
        "currency_symbol": store["currency_symbol"],
    })
