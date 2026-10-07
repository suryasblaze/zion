"""
Admin API.

Generic CRUD is table-driven: one whitelist of editable tables and their
editable columns, so adding a manageable entity is a dictionary entry
rather than another six endpoints. Identifiers are composed through
psycopg.sql, never f-strings, and values are always parameters.
"""
import json

from flask import Blueprint, g, request
from psycopg import sql

import db
from services import referral_service, settings_service, wallet_service
from utils.auth import admin_required
from utils.helpers import (client_ip, fail, hash_ip, money, ok, paginate_args, slugify,
                           to_jsonable)

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

# ---------------------------------------------------------------------
# What the admin panel may edit, and which columns of it.
# ---------------------------------------------------------------------
TABLES = {
    "products": {
        "columns": ["category_id", "name", "slug", "script_word", "botanical_name", "tagline",
                    "short_desc", "description", "story", "accent_color", "accent_soft",
                    "hero_image", "gallery", "benefits", "ingredients", "brewing", "badges",
                    "nutrition", "is_caffeine_free", "is_active", "is_featured", "sort_order",
                    "seo"],
        "json": ["gallery", "benefits", "ingredients", "brewing", "badges", "nutrition", "seo"],
        "order": "sort_order, name",
        "search": ["name", "slug", "botanical_name"],
    },
    "product_variants": {
        "columns": ["product_id", "sku", "label", "weight_grams", "price", "compare_at_price",
                    "stock", "low_stock_at", "is_default", "is_active", "sort_order"],
        "json": [], "order": "sort_order, price", "search": ["sku", "label"],
    },
    "categories": {
        "columns": ["name", "slug", "description", "image_url", "sort_order", "is_active"],
        "json": [], "order": "sort_order, name", "search": ["name", "slug"],
    },
    "faqs": {
        "columns": ["question", "answer", "category", "scope", "product_id", "sort_order",
                    "is_active"],
        "json": [], "order": "sort_order, question", "search": ["question", "answer"],
    },
    "pages": {
        "columns": ["slug", "title", "excerpt", "body", "hero_image", "page_type", "seo",
                    "is_published", "author", "read_minutes"],
        "json": ["seo"], "order": "title", "search": ["title", "slug"],
    },
    "page_sections": {
        "columns": ["page", "section_key", "component", "eyebrow", "title", "subtitle", "body",
                    "media", "items", "cta", "settings", "sort_order", "is_active"],
        "json": ["media", "items", "cta", "settings"], "order": "page, sort_order",
        "search": ["title", "section_key"],
    },
    "nav_items": {
        "columns": ["menu", "label", "href", "parent_id", "badge", "is_external", "sort_order",
                    "is_active"],
        "json": [], "order": "menu, sort_order", "search": ["label", "href"],
    },
    "testimonials": {
        "columns": ["author", "role", "city", "quote", "rating", "avatar_url", "product_id",
                    "is_active", "sort_order"],
        "json": [], "order": "sort_order", "search": ["author", "quote"],
    },
    "coupons": {
        "columns": ["code", "description", "discount_type", "value", "min_order", "max_discount",
                    "usage_limit", "per_user_limit", "starts_at", "ends_at", "is_active"],
        "json": [], "order": "created_at desc", "search": ["code", "description"],
    },
    "locations": {
        "columns": ["name", "kind", "line1", "line2", "city", "state", "pincode", "country",
                    "latitude", "longitude", "phone", "email", "whatsapp", "opening_hours",
                    "map_url", "service_areas", "is_primary", "is_active"],
        "json": ["opening_hours", "service_areas"], "order": "name", "search": ["name", "city"],
    },
    "theme_presets": {
        "columns": ["name", "slug", "description", "tokens", "is_active"],
        "json": ["tokens"], "order": "name", "search": ["name"],
    },
    "reviews": {
        "columns": ["author_name", "rating", "title", "body", "is_approved", "is_verified"],
        "json": [], "order": "created_at desc", "search": ["author_name", "title"],
    },
    "redirects": {
        "columns": ["from_path", "to_path", "status_code", "is_active"],
        "json": [], "order": "from_path", "search": ["from_path", "to_path"],
    },
}


def _spec(table):
    spec = TABLES.get(table)
    if not spec:
        return None, fail(f"'{table}' is not an editable collection.", 404, code="unknown_table")
    return spec, None


def _audit(action, entity, entity_id, changes=None):
    db.execute(
        """insert into audit_log (actor_id, actor_email, action, entity, entity_id, changes, ip_hash)
           values (%s,%s,%s,%s,%s,%s::jsonb,%s)""",
        (g.user["id"], g.user["email"], action, entity, str(entity_id),
         json.dumps(changes or {}, default=str), hash_ip(client_ip())),
    )


def _prepare(spec, payload):
    """Keep only whitelisted columns; JSON columns are dumped, not interpolated."""
    cols, vals = [], []
    for key in spec["columns"]:
        if key not in payload:
            continue
        value = payload[key]
        if key in spec["json"]:
            value = json.dumps(value if value is not None else ([] if key != "seo" else {}))
        if value == "":
            value = None
        cols.append(key)
        vals.append(value)
    return cols, vals


# ===================================================================== CRUD
@bp.get("/<table>")
@admin_required
def list_rows(table):
    spec, err = _spec(table)
    if err:
        return err
    page, limit, offset = paginate_args(default_limit=50, max_limit=200)
    search = request.args.get("q")

    where, params = sql.SQL(""), []
    if search and spec["search"]:
        clauses = [sql.SQL("{} ilike %s").format(sql.Identifier(c)) for c in spec["search"]]
        where = sql.SQL(" where ") + sql.SQL(" or ").join(clauses)
        params = [f"%{search}%"] * len(spec["search"])

    query = sql.SQL("select * from {t}{w} order by {o} limit %s offset %s").format(
        t=sql.Identifier(table), w=where, o=sql.SQL(spec["order"])
    )
    count_q = sql.SQL("select count(*) as n from {t}{w}").format(
        t=sql.Identifier(table), w=where
    )

    with db.cursor() as cur:
        cur.execute(query, (*params, limit, offset))
        rows = cur.fetchall()
        cur.execute(count_q, tuple(params))
        total = cur.fetchone()["n"]

    return ok(to_jsonable(rows), meta={"page": page, "limit": limit, "total": total})


@bp.post("/<table>")
@admin_required
def create_row(table):
    spec, err = _spec(table)
    if err:
        return err
    payload = request.get_json(silent=True) or {}

    if "slug" in spec["columns"] and not payload.get("slug"):
        payload["slug"] = slugify(payload.get("name") or payload.get("title") or "item")

    cols, vals = _prepare(spec, payload)
    if not cols:
        return fail("Nothing to save.", 422)

    stmt = sql.SQL("insert into {t} ({c}) values ({v}) returning *").format(
        t=sql.Identifier(table),
        c=sql.SQL(", ").join(map(sql.Identifier, cols)),
        v=sql.SQL(", ").join(sql.Placeholder() * len(vals)),
    )
    try:
        with db.cursor() as cur:
            cur.execute(stmt, tuple(vals))
            row = cur.fetchone()
    except Exception as exc:
        return _friendly(exc)

    _audit("create", table, row["id"], payload)
    return ok(to_jsonable(row), message="Saved.", status=201)


@bp.patch("/<table>/<row_id>")
@admin_required
def update_row(table, row_id):
    spec, err = _spec(table)
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    cols, vals = _prepare(spec, payload)
    if not cols:
        return fail("Nothing to change.", 422)

    assignments = sql.SQL(", ").join(
        sql.SQL("{} = {}").format(sql.Identifier(c), sql.Placeholder()) for c in cols
    )
    stmt = sql.SQL("update {t} set {a} where id = %s returning *").format(
        t=sql.Identifier(table), a=assignments
    )
    try:
        with db.cursor() as cur:
            cur.execute(stmt, (*vals, row_id))
            row = cur.fetchone()
    except Exception as exc:
        return _friendly(exc)

    if not row:
        return fail("That record no longer exists.", 404)
    _audit("update", table, row_id, payload)
    return ok(to_jsonable(row), message="Saved.")


@bp.delete("/<table>/<row_id>")
@admin_required
def delete_row(table, row_id):
    spec, err = _spec(table)
    if err:
        return err
    if table == "theme_presets":
        if db.scalar("select is_system from theme_presets where id = %s", (row_id,)):
            return fail("Built-in themes cannot be deleted. Duplicate it and edit the copy.", 400)

    stmt = sql.SQL("delete from {t} where id = %s").format(t=sql.Identifier(table))
    try:
        count = db.execute(stmt, (row_id,))
    except Exception as exc:
        return _friendly(exc)

    if not count:
        return fail("That record no longer exists.", 404)
    _audit("delete", table, row_id)
    return ok(message="Deleted.")


def _friendly(exc):
    """Turn a constraint violation into something an admin can act on."""
    text = str(exc).lower()
    if "duplicate key" in text or "unique constraint" in text:
        if "slug" in text:
            return fail("That web address is already used by another item. Change the slug.", 409)
        if "sku" in text:
            return fail("That SKU already exists. SKUs must be unique.", 409)
        if "code" in text:
            return fail("That code is already in use.", 409)
        return fail("Something with that value already exists.", 409)
    if "foreign key" in text:
        return fail("Something else still refers to this. Remove those first.", 409)
    if "violates check constraint" in text:
        return fail("One of those values is out of range.", 422)
    if "not-null" in text or "null value" in text:
        return fail("A required field is missing.", 422)
    raise exc


# ================================================================ settings
@bp.get("/settings/all")
@admin_required
def all_settings():
    return ok(to_jsonable(settings_service.grouped()))


@bp.put("/settings")
@admin_required
def save_settings():
    payload = request.get_json(silent=True) or {}
    updates = payload.get("settings") or payload
    changed = settings_service.set_many(updates, g.user["id"])
    _audit("update", "admin_settings", "bulk", updates)
    return ok({"changed": changed}, message=f"{changed} setting{'s' if changed != 1 else ''} saved.")


# ================================================================== theme
@bp.post("/theme/<theme_id>/activate")
@admin_required
def activate_theme(theme_id):
    with db.transaction() as cur:
        cur.execute("update theme_presets set is_active = false where is_active")
        cur.execute("update theme_presets set is_active = true where id = %s returning name",
                    (theme_id,))
        row = cur.fetchone()
    if not row:
        return fail("That theme no longer exists.", 404)
    _audit("publish", "theme_presets", theme_id)
    return ok(message=f"“{row['name']}” is now live on the storefront.")


# ================================================================= orders
ORDER_STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded"]


@bp.get("/orders")
@admin_required
def orders():
    page, limit, offset = paginate_args(default_limit=40, max_limit=200)
    status = request.args.get("status")
    search = request.args.get("q")

    where, params = ["1=1"], []
    if status and status != "all":
        where.append("o.status = %s")
        params.append(status)
    if search:
        where.append("(o.order_number ilike %s or o.email ilike %s or o.phone ilike %s)")
        params += [f"%{search}%"] * 3
    clause = " and ".join(where)

    rows = db.query(
        f"""select o.id, o.order_number, o.email, o.phone, o.status, o.payment_status,
                   o.payment_method, o.subtotal, o.coupon_discount, o.referral_discount,
                   o.coins_redeemed, o.coins_value, o.shipping_fee, o.tax, o.total,
                   o.placed_at, o.referral_code_used, o.tracking_number,
                   o.shipping_address, u.full_name,
                   (select count(*) from order_items i where i.order_id = o.id) as item_count
              from orders o
              left join users u on u.id = o.user_id
             where {clause}
             order by o.placed_at desc limit %s offset %s""",
        (*params, limit, offset),
    )
    total = db.scalar(f"select count(*) from orders o where {clause}", tuple(params))
    return ok(to_jsonable(rows), meta={"page": page, "limit": limit, "total": total})


@bp.get("/orders/<order_id>")
@admin_required
def order_detail(order_id):
    row = db.query_one(
        """select o.*, u.full_name, u.referral_code
             from orders o left join users u on u.id = o.user_id
            where o.id = %s""",
        (order_id,),
    )
    if not row:
        return fail("That order no longer exists.", 404)
    row["items"] = db.query("select * from order_items where order_id = %s", (order_id,))
    row["events"] = db.query(
        "select status, note, created_at from order_events where order_id = %s order by created_at",
        (order_id,),
    )
    return ok(to_jsonable(row))


@bp.patch("/orders/<order_id>")
@admin_required
def update_order(order_id):
    """
    Changing an order's state is what fires the referral reward, so this
    goes through the referral service rather than writing points directly.
    """
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    payment_status = data.get("payment_status")

    if status and status not in ORDER_STATUSES:
        return fail(f"'{status}' is not a valid order status.", 422)
    if payment_status and payment_status not in ("unpaid", "paid", "failed", "refunded",
                                                 "partially_refunded"):
        return fail(f"'{payment_status}' is not a valid payment status.", 422)

    sets, params = [], []
    if status:
        sets.append("status = %s")
        params.append(status)
        if status == "delivered":
            sets.append("delivered_at = coalesce(delivered_at, now())")
        if status == "cancelled":
            sets.append("cancelled_at = coalesce(cancelled_at, now())")
    if payment_status:
        sets.append("payment_status = %s")
        params.append(payment_status)
        if payment_status == "paid":
            sets.append("paid_at = coalesce(paid_at, now())")
    for field in ("tracking_number", "tracking_url", "admin_note"):
        if field in data:
            sets.append(f"{field} = %s")
            params.append(data[field])

    if not sets:
        return fail("Nothing to change.", 422)

    row = db.insert_returning(
        f"update orders set {', '.join(sets)} where id = %s returning *", (*params, order_id)
    )
    if not row:
        return fail("That order no longer exists.", 404)

    if status or payment_status:
        db.execute(
            "insert into order_events (order_id, status, note, actor_id) values (%s,%s,%s,%s)",
            (order_id, status or row["status"], data.get("note") or "Updated by admin",
             g.user["id"]),
        )

    reward = None
    if payment_status == "paid" or status == "delivered":
        reward = referral_service.on_order_paid(order_id)
    if payment_status == "refunded" or status in ("cancelled", "refunded"):
        reward = referral_service.on_order_reversed(order_id, "Order cancelled or refunded")
        # Give back any coins the customer spent on it.
        if row["coins_redeemed"] and row["user_id"]:
            try:
                wallet_service.credit(
                    row["user_id"], row["coins_redeemed"], "redeem_refund",
                    reference_type="order", reference_id=order_id,
                    idempotency_key=f"redeem_refund:{order_id}",
                    note=f"Refund of coins on {row['order_number']}",
                )
            except Exception:
                pass

    _audit("update", "orders", order_id, data)
    return ok({"order": to_jsonable(row), "referral": to_jsonable(reward)},
              message="Order updated.")


# =============================================================== customers
@bp.get("/customers")
@admin_required
def customers():
    page, limit, offset = paginate_args(default_limit=40, max_limit=200)
    search = request.args.get("q")
    where, params = ["u.role = 'customer'"], []
    if search:
        where.append("(u.full_name ilike %s or u.email ilike %s or u.referral_code ilike %s)")
        params += [f"%{search}%"] * 3
    clause = " and ".join(where)

    rows = db.query(
        f"""select u.id, u.full_name, u.email, u.phone, u.referral_code, u.wallet_balance,
                   u.is_active, u.created_at, u.last_login_at,
                   (select count(*) from orders o where o.user_id = u.id) as orders,
                   coalesce((select sum(o.total) from orders o
                              where o.user_id = u.id and o.payment_status = 'paid'), 0) as spent,
                   (select count(*) from referrals r where r.referrer_id = u.id) as referrals,
                   ref.full_name as referred_by_name
              from users u
              left join users ref on ref.id = u.referred_by
             where {clause}
             order by u.created_at desc limit %s offset %s""",
        (*params, limit, offset),
    )
    total = db.scalar(f"select count(*) from users u where {clause}", tuple(params))
    return ok(to_jsonable(rows), meta={"page": page, "limit": limit, "total": total})


@bp.post("/customers")
@admin_required
def create_customer():
    """
    Create an account by hand.

    This is how accounts are made now that public registration is shut.
    The role is chosen explicitly rather than defaulting to admin: an
    account that can read every customer record should be a decision, not
    an accident of leaving a field blank.
    """
    from utils.auth import hash_password
    from utils.helpers import generate_referral_code, password_problems, valid_email, valid_phone

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip() or None
    password = data.get("password") or ""
    role = (data.get("role") or "customer").strip()

    errors = {}
    if not valid_email(email):
        errors["email"] = "Enter a valid email address."
    if not full_name:
        errors["full_name"] = "Give the account a name."
    if not valid_phone(phone):
        errors["phone"] = "Enter a valid phone number, or leave it blank."
    if role not in ("customer", "staff", "admin"):
        errors["role"] = "Choose customer, staff or admin."
    problems = password_problems(password)
    if problems:
        errors["password"] = " ".join(problems)
    if errors:
        return fail("Check the highlighted fields.", 422, errors=errors)

    if db.scalar("select 1 from users where email = %s", (email,)):
        return fail("An account with that email already exists.", 409, code="email_taken")

    with db.transaction() as cur:
        code = generate_referral_code(full_name)
        for _ in range(5):
            cur.execute("select 1 from users where referral_code = %s", (code,))
            if not cur.fetchone():
                break
            code = generate_referral_code(full_name)

        cur.execute(
            """insert into users
                 (email, password_hash, full_name, phone, role, referral_code,
                  email_verified)
               values (%s,%s,%s,%s,%s,%s,true)
               returning id, email, full_name, phone, role, referral_code,
                         wallet_balance, is_active, created_at""",
            (email, hash_password(password), full_name, phone, role, code),
        )
        row = cur.fetchone()

    _audit("create", "users", row["id"], {"email": email, "role": role})
    return ok(to_jsonable(row),
              message=f"Account created for {full_name}. They can sign in now.",
              status=201)


@bp.post("/customers/<user_id>/wallet")
@admin_required
def adjust_wallet(user_id):
    """Manual credit or debit. Always leaves a ledger row and an audit entry."""
    data = request.get_json(silent=True) or {}
    try:
        points = int(data.get("points") or 0)
    except (TypeError, ValueError):
        return fail("Points must be a whole number.", 422)
    if points == 0:
        return fail("Enter a number of points to add or take away.", 422)

    note = (data.get("note") or "").strip()
    if not note:
        return fail("Say why you are adjusting this balance.", 422,
                    errors={"note": "A reason is required."})

    try:
        with db.transaction() as cur:
            txn = wallet_service.move(
                cur, user_id, points,
                "admin_credit" if points > 0 else "admin_debit",
                reference_type="manual", note=note, created_by=g.user["id"],
            )
    except Exception as exc:
        if "insufficient balance" in str(exc).lower():
            return fail("That customer does not have enough points for this deduction.", 409)
        raise

    _audit("update", "users", user_id, {"points": points, "note": note})
    return ok(to_jsonable(txn), message=f"{abs(points):,} points {'added' if points > 0 else 'removed'}.")


@bp.patch("/customers/<user_id>")
@admin_required
def update_customer(user_id):
    data = request.get_json(silent=True) or {}
    if "is_active" not in data:
        return fail("Nothing to change.", 422)
    row = db.insert_returning(
        "update users set is_active = %s where id = %s returning id, full_name, is_active",
        (bool(data["is_active"]), user_id),
    )
    if not row:
        return fail("That customer no longer exists.", 404)
    _audit("update", "users", user_id, data)
    return ok(to_jsonable(row), message="Customer updated.")


# =============================================================== referrals
@bp.get("/referrals")
@admin_required
def referrals():
    page, limit, offset = paginate_args(default_limit=40)
    status = request.args.get("status")
    where, params = ["1=1"], []
    if status and status != "all":
        where.append("r.status = %s")
        params.append(status)
    if request.args.get("flagged") == "1":
        where.append("r.fraud_flags <> '[]'::jsonb")
    clause = " and ".join(where)

    rows = db.query(
        f"""select r.*, ref.full_name as referrer_name, ref.email as referrer_email,
                   tee.full_name as referee_name, tee.email as referee_email,
                   o.order_number, o.total as order_total
              from referrals r
              join users ref on ref.id = r.referrer_id
              join users tee on tee.id = r.referee_id
              left join orders o on o.id = r.qualifying_order_id
             where {clause}
             order by r.created_at desc limit %s offset %s""",
        (*params, limit, offset),
    )
    total = db.scalar(f"select count(*) from referrals r where {clause}", tuple(params))
    return ok(to_jsonable(rows), meta={"page": page, "limit": limit, "total": total})


@bp.post("/referrals/<referral_id>/approve")
@admin_required
def approve_referral(referral_id):
    result = referral_service.approve_flagged(referral_id, g.user["id"])
    _audit("update", "referrals", referral_id, {"action": "approve"})
    if not result.get("rewarded"):
        reasons = {
            "already_rewarded": "That referral has already been paid.",
            "no_qualifying_order": "The referred customer has not completed an order yet.",
            "not_found": "That referral no longer exists.",
        }
        return fail(reasons.get(result.get("reason"), "Could not pay that referral."), 409)
    return ok(to_jsonable(result), message=f"{result['points']:,} points paid to the referrer.")


@bp.post("/referrals/<referral_id>/reject")
@admin_required
def reject_referral(referral_id):
    reason = (request.get_json(silent=True) or {}).get("reason") or "Rejected by admin"
    count = referral_service.reject(referral_id, reason, g.user["id"])
    if not count:
        return fail("That referral cannot be rejected — it may already be paid.", 409)
    _audit("update", "referrals", referral_id, {"action": "reject", "reason": reason})
    return ok(message="Referral rejected.")


@bp.post("/referrals/process-due")
@admin_required
def process_due():
    result = referral_service.process_due_rewards()
    return ok(result, message=f"{result['paid']} referral reward(s) paid.")


# =============================================================== dashboard
@bp.get("/dashboard")
@admin_required
def dashboard():
    stats = db.query_one(
        """select
             (select count(*) from orders where placed_at > now() - interval '30 days') as orders_30d,
             (select coalesce(sum(total),0) from orders
               where payment_status = 'paid' and placed_at > now() - interval '30 days') as revenue_30d,
             (select coalesce(sum(total),0) from orders where payment_status = 'paid') as revenue_all,
             (select count(*) from orders where status = 'pending') as pending_orders,
             (select count(*) from users where role = 'customer') as customers,
             (select count(*) from users
               where role = 'customer' and created_at > now() - interval '30 days') as customers_30d,
             (select count(*) from referrals) as referrals_total,
             (select count(*) from referrals where status = 'rewarded') as referrals_paid,
             (select count(*) from referrals
               where fraud_flags <> '[]'::jsonb and status not in ('rewarded','rejected')) as referrals_flagged,
             (select coalesce(sum(wallet_balance),0) from users) as coins_outstanding,
             (select count(*) from contact_messages where status = 'new') as unread_messages,
             (select count(*) from reviews where not is_approved) as pending_reviews"""
    )

    low_stock = db.query(
        """select v.sku, v.label, v.stock, v.low_stock_at, p.name, p.slug
             from product_variants v join products p on p.id = v.product_id
            where v.is_active and v.stock <= v.low_stock_at
            order by v.stock limit 12"""
    )
    recent = db.query(
        """select order_number, email, total, status, payment_status, placed_at
             from orders order by placed_at desc limit 8"""
    )
    daily = db.query(
        """select date_trunc('day', placed_at)::date as day,
                  count(*) as orders,
                  coalesce(sum(total) filter (where payment_status = 'paid'), 0) as revenue
             from orders
            where placed_at > now() - interval '30 days'
            group by 1 order by 1"""
    )
    top = db.query(
        """select i.product_name, sum(i.quantity) as units,
                  sum(i.line_total) as revenue
             from order_items i join orders o on o.id = i.order_id
            where o.placed_at > now() - interval '30 days'
            group by 1 order by revenue desc limit 6"""
    )
    top_referrers = db.query(
        """select full_name, email, referral_code, clicks, signups, conversions, points_earned
             from referral_stats where signups > 0
            order by conversions desc, signups desc limit 8"""
    )

    wallet = settings_service.wallet_config()
    stats["coins_liability"] = money(
        wallet_service.points_to_rupees(stats["coins_outstanding"], wallet)
    )

    return ok(to_jsonable({
        "stats": stats, "low_stock": low_stock, "recent_orders": recent,
        "daily": daily, "top_products": top, "top_referrers": top_referrers,
    }))


@bp.get("/audit")
@admin_required
def audit():
    page, limit, offset = paginate_args(default_limit=50)
    rows = db.query(
        """select actor_email, action, entity, entity_id, changes, created_at
             from audit_log order by created_at desc limit %s offset %s""",
        (limit, offset),
    )
    return ok(to_jsonable(rows), meta={"page": page, "limit": limit})


@bp.get("/messages")
@admin_required
def messages():
    rows = db.query(
        "select * from contact_messages order by created_at desc limit 100"
    )
    return ok(to_jsonable(rows))
