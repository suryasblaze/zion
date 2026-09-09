"""
Cart pricing, order placement, and the customer's order history.

Prices are always read from the database inside the same transaction that
writes the order. Nothing the client sends about money is trusted -- the
request only names SKUs and quantities.
"""
from decimal import ROUND_HALF_UP, Decimal

from flask import Blueprint, g, request

import db
from services import referral_service, settings_service, wallet_service
from utils.auth import login_required, optional_auth
from utils.helpers import (fail, generate_order_number, money, ok, paginate_args, to_jsonable,
                           valid_email, valid_phone)

bp = Blueprint("checkout", __name__, url_prefix="/api")


def _q(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _load_lines(cur, items):
    """Resolve [{sku, quantity}] against live variant rows, locked for update."""
    skus = [str(i.get("sku")) for i in items if i.get("sku")]
    if not skus:
        return [], "Your bag is empty."

    cur.execute(
        """select v.id, v.sku, v.label, v.price, v.stock, v.is_active,
                  p.id as product_id, p.name, p.slug, p.hero_image, p.is_active as p_active
             from product_variants v
             join products p on p.id = v.product_id
            where v.sku = any(%s)
            for update of v""",
        (skus,),
    )
    found = {r["sku"]: r for r in cur.fetchall()}

    lines = []
    for item in items:
        sku = str(item.get("sku"))
        qty = int(item.get("quantity") or item.get("qty") or 1)
        if qty < 1:
            continue
        row = found.get(sku)
        if not row or not row["is_active"] or not row["p_active"]:
            return [], f"{sku} is no longer available. Remove it to continue."
        if row["stock"] < qty:
            available = row["stock"]
            if available == 0:
                return [], f"{row['name']} {row['label']} has just sold out."
            return [], f"Only {available} left of {row['name']} {row['label']}."
        lines.append({
            "variant_id": row["id"], "product_id": row["product_id"], "sku": sku,
            "name": row["name"], "slug": row["slug"], "label": row["label"],
            "image": row["hero_image"], "unit_price": _q(row["price"]), "quantity": qty,
            "line_total": _q(Decimal(str(row["price"])) * qty),
        })

    return lines, None


def _coupon_discount(cur, code, subtotal, user_id):
    if not code:
        return _q(0), None, None
    cur.execute("select * from coupons where code = %s and is_active for update", (code,))
    c = cur.fetchone()
    if not c:
        return _q(0), None, "That coupon code is not valid."
    now_ok = db.scalar(
        "select (%s is null or %s <= now()) and (%s is null or %s >= now())",
        (c["starts_at"], c["starts_at"], c["ends_at"], c["ends_at"]),
    )
    if not now_ok:
        return _q(0), None, "That coupon is not active right now."
    if c["usage_limit"] is not None and c["used_count"] >= c["usage_limit"]:
        return _q(0), None, "That coupon has been fully claimed."
    if subtotal < _q(c["min_order"]):
        return _q(0), None, f"Spend ₹{c['min_order']:,.0f} to use this coupon."
    if user_id:
        cur.execute(
            "select count(*) as n from orders where user_id = %s and coupon_code = %s",
            (user_id, c["code"]),
        )
        if cur.fetchone()["n"] >= c["per_user_limit"]:
            return _q(0), None, "You have already used that coupon."

    if c["discount_type"] == "percent":
        amount = subtotal * _q(c["value"]) / Decimal(100)
        if c["max_discount"]:
            amount = min(amount, _q(c["max_discount"]))
    else:
        amount = _q(c["value"])

    return _q(min(amount, subtotal)), c["code"], None


def _price(cur, items, user_id, coupon_code=None, coins=None):
    """
    The single pricing function. Both /quote and /place call it so the
    number a customer is shown is the number they are charged.
    Order of operations: coupon, then referral, then coins, then shipping
    and tax on what is left.
    """
    store = settings_service.store_config()
    lines, err = _load_lines(cur, items)
    if err:
        return None, err

    subtotal = _q(sum(l["line_total"] for l in lines))

    coupon_amount, applied_code, coupon_note = _coupon_discount(cur, coupon_code, subtotal, user_id)

    referral = {"amount": 0.0, "label": None, "referral_id": None, "reason": None}
    if user_id:
        referral = referral_service.quote_referee_discount(user_id, float(subtotal))
    referral_amount = _q(referral["amount"])

    after_discounts = max(_q(0), subtotal - coupon_amount - referral_amount)

    # `coins` is three-valued on purpose:
    #   None -> spend as many as the rules allow (the default, and what the
    #           checkout's "use my coins" checkbox means when ticked)
    #   0    -> spend none (checkbox cleared)
    #   n    -> spend at most n
    # Reading None as zero is what previously made the checkbox do nothing.
    coin_quote = {"applicable_points": 0, "discount": 0.0, "max_points": 0,
                  "max_discount": 0.0, "reason": None, "balance": 0}
    if user_id:
        requested = None if coins is None else max(0, int(coins))
        coin_quote = wallet_service.redemption_quote(
            user_id, float(after_discounts), requested
        )
    coins_value = _q(coin_quote["discount"])
    coins_points = int(coin_quote["applicable_points"])

    taxable = max(_q(0), after_discounts - coins_value)

    shipping = _q(0) if subtotal >= _q(store["free_shipping_over"]) else _q(store["shipping_flat"])
    tax = _q(taxable * _q(store["tax_percent"]) / Decimal(100))
    total = _q(taxable + shipping + tax)

    return {
        "lines": lines,
        "subtotal": subtotal,
        "coupon_code": applied_code,
        "coupon_discount": coupon_amount,
        "coupon_note": coupon_note,
        "referral_discount": referral_amount,
        "referral_label": referral["label"],
        "referral_note": referral["reason"],
        "coins_redeemed": coins_points,
        "coins_value": coins_value,
        "coins_max": coin_quote["max_points"],
        "coins_note": coin_quote["reason"],
        "coins_balance": coin_quote.get("balance", 0),
        "shipping_fee": shipping,
        "tax": tax,
        "total": total,
        "currency": store["currency"],
    }, None


def _public(p):
    """Money as floats, lines trimmed for the client."""
    return {
        "items": [
            {"sku": l["sku"], "name": l["name"], "slug": l["slug"], "label": l["label"],
             "image": l["image"], "unit_price": money(l["unit_price"]),
             "quantity": l["quantity"], "line_total": money(l["line_total"])}
            for l in p["lines"]
        ],
        "subtotal": money(p["subtotal"]),
        "coupon_code": p["coupon_code"],
        "coupon_discount": money(p["coupon_discount"]),
        "coupon_note": p["coupon_note"],
        "referral_discount": money(p["referral_discount"]),
        "referral_label": p["referral_label"],
        "referral_note": p["referral_note"],
        "coins_redeemed": p["coins_redeemed"],
        "coins_value": money(p["coins_value"]),
        "coins_max": p["coins_max"],
        "coins_note": p["coins_note"],
        "coins_balance": p["coins_balance"],
        "shipping_fee": money(p["shipping_fee"]),
        "tax": money(p["tax"]),
        "total": money(p["total"]),
        "currency": p["currency"],
    }


# ===================================================================== quote
@bp.post("/checkout/quote")
@optional_auth
def quote():
    data = request.get_json(silent=True) or {}
    user_id = g.user["id"] if getattr(g, "user", None) else None

    with db.transaction() as cur:
        priced, err = _price(cur, data.get("items") or [], user_id,
                             data.get("coupon_code"), data.get("coins"))
        if err:
            return fail(err, 409, code="cart_problem")
        return ok(_public(priced))


# ===================================================================== place
@bp.post("/checkout/place")
@optional_auth
def place():
    data = request.get_json(silent=True) or {}
    user = getattr(g, "user", None)
    user_id = user["id"] if user else None

    address = data.get("shipping_address") or {}
    email = (data.get("email") or (user or {}).get("email") or "").strip().lower()
    phone = (address.get("phone") or (user or {}).get("phone") or "").strip()
    method = data.get("payment_method") or "cod"

    errors = {}
    if not valid_email(email):
        errors["email"] = "We need a valid email to send the receipt."
    if not valid_phone(phone) or not phone:
        errors["phone"] = "We need a phone number for delivery."
    for field, label in (("full_name", "Name"), ("line1", "Address"),
                         ("city", "City"), ("state", "State"), ("pincode", "Pincode")):
        if not (address.get(field) or "").strip():
            errors[field] = f"{label} is required."
    if errors:
        return fail("Check the highlighted fields.", 422, errors=errors)

    store = settings_service.store_config()
    allowed = {"cod": store["cod_enabled"], "razorpay": store["razorpay_enabled"],
               "whatsapp": store["whatsapp_order_enabled"], "upi": store["razorpay_enabled"]}
    if not allowed.get(method):
        return fail("That payment method is not available.", 400, code="method_unavailable")

    with db.transaction() as cur:
        priced, err = _price(cur, data.get("items") or [], user_id,
                             data.get("coupon_code"), data.get("coins"))
        if err:
            return fail(err, 409, code="cart_problem")

        cur.execute(
            """insert into orders
                 (order_number, user_id, email, phone, status, payment_status,
                  payment_method, subtotal, coupon_code, coupon_discount,
                  referral_discount, coins_redeemed, coins_value, shipping_fee,
                  tax, total, currency, shipping_address, billing_address,
                  customer_note)
               values (%s,%s,%s,%s,'pending','unpaid',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                       %s::jsonb, %s::jsonb, %s)
               returning id, order_number, total, placed_at""",
            (generate_order_number(), user_id, email, phone, method,
             priced["subtotal"], priced["coupon_code"], priced["coupon_discount"],
             priced["referral_discount"], priced["coins_redeemed"], priced["coins_value"],
             priced["shipping_fee"], priced["tax"], priced["total"], priced["currency"],
             __import__("json").dumps(address),
             __import__("json").dumps(data.get("billing_address") or address),
             (data.get("customer_note") or "").strip()[:500]),
        )
        order = cur.fetchone()

        for l in priced["lines"]:
            cur.execute(
                """insert into order_items
                     (order_id, product_id, variant_id, product_name, variant_label,
                      sku, image_url, unit_price, quantity, line_total)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (order["id"], l["product_id"], l["variant_id"], l["name"], l["label"],
                 l["sku"], l["image"], l["unit_price"], l["quantity"], l["line_total"]),
            )
            cur.execute(
                "update product_variants set stock = stock - %s where id = %s",
                (l["quantity"], l["variant_id"]),
            )

        # Spend the coins in the same transaction that creates the order.
        # If anything after this raises, the points come back automatically.
        if user_id and priced["coins_redeemed"] > 0:
            wallet_service.move(
                cur, user_id, -priced["coins_redeemed"], "redeem",
                reference_type="order", reference_id=order["id"],
                idempotency_key=f"redeem:{order['id']}",
                money_value=priced["coins_value"],
                note=f"Redeemed on order {order['order_number']}",
            )

        if priced["coupon_code"]:
            cur.execute("update coupons set used_count = used_count + 1 where code = %s",
                        (priced["coupon_code"],))

        cur.execute(
            "insert into order_events (order_id, status, note) values (%s,'pending',%s)",
            (order["id"], "Order placed"),
        )

    # COD and WhatsApp orders are not paid yet, so no referral reward fires
    # here -- it fires when an admin marks the order paid or delivered.
    if method in ("razorpay", "upi"):
        pass  # the payment webhook marks it paid, then triggers the reward

    return ok(
        {
            "order_id": str(order["id"]),
            "order_number": order["order_number"],
            "total": money(order["total"]),
            "payment_method": method,
            "breakdown": _public(priced),
        },
        message=f"Order {order['order_number']} placed. We will confirm it shortly.",
        status=201,
    )


# ==================================================================== orders
@bp.get("/orders")
@login_required
def my_orders():
    page, limit, offset = paginate_args(default_limit=20)
    rows = db.query(
        """select o.id, o.order_number, o.status, o.payment_status, o.payment_method,
                  o.total, o.currency, o.placed_at, o.tracking_number, o.tracking_url,
                  coalesce((
                    select json_agg(json_build_object(
                      'name', i.product_name, 'label', i.variant_label,
                      'quantity', i.quantity, 'line_total', i.line_total,
                      'image', i.image_url))
                    from order_items i where i.order_id = o.id
                  ), '[]'::json) as items
             from orders o
            where o.user_id = %s
            order by o.placed_at desc
            limit %s offset %s""",
        (g.user["id"], limit, offset),
    )
    return ok(to_jsonable(rows), meta={"page": page, "limit": limit})


@bp.get("/orders/<order_number>")
@login_required
def order_detail(order_number):
    row = db.query_one(
        """select * from orders where order_number = %s and user_id = %s""",
        (order_number, g.user["id"]),
    )
    if not row:
        return fail("We could not find that order.", 404)
    row["items"] = db.query("select * from order_items where order_id = %s", (row["id"],))
    row["events"] = db.query(
        "select status, note, created_at from order_events where order_id = %s order by created_at",
        (row["id"],),
    )
    return ok(to_jsonable(row))
