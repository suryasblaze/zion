"""Public catalogue: products, variants, categories, reviews."""
from flask import Blueprint, g, request

import db
from services import settings_service
from utils.auth import login_required
from utils.helpers import fail, ok, paginate_args, to_jsonable

bp = Blueprint("catalog", __name__, url_prefix="/api")

PRODUCT_COLUMNS = """
  p.id, p.name, p.slug, p.script_word, p.botanical_name, p.tagline,
  p.short_desc, p.description, p.story, p.accent_color, p.accent_soft,
  p.hero_image, p.gallery, p.benefits, p.ingredients, p.brewing, p.badges,
  p.is_caffeine_free, p.is_featured, p.rating_avg, p.rating_count, p.seo,
  p.sort_order,
  -- Added by 005 and then left out of here, so four of the detail
  -- panel's sections existed in the database and reached nobody: the
  -- storefront fell back to its bundled copy and looked fine, which is
  -- why it went unnoticed.
  p.nutrition, p.taste_aroma, p.origin, p.why_love,
  c.slug as category_slug, c.name as category_name
"""

VARIANTS = """
  coalesce((
    select json_agg(json_build_object(
      'id', v.id, 'sku', v.sku, 'label', v.label, 'weight_grams', v.weight_grams,
      'price', v.price, 'compare_at_price', v.compare_at_price,
      'stock', v.stock, 'is_default', v.is_default
    ) order by v.sort_order, v.price)
    from product_variants v
    where v.product_id = p.id and v.is_active
  ), '[]'::json) as sizes
"""


@bp.get("/products")
def list_products():
    page, limit, offset = paginate_args()
    category = request.args.get("category")
    featured = request.args.get("featured")
    search = request.args.get("q")

    where = ["p.is_active"]
    params = []
    if category:
        where.append("c.slug = %s")
        params.append(category)
    if featured in ("1", "true"):
        where.append("p.is_featured")
    if search:
        where.append("(p.name ilike %s or p.short_desc ilike %s or p.botanical_name ilike %s)")
        params += [f"%{search}%"] * 3

    clause = " and ".join(where)

    rows = db.query(
        f"""select {PRODUCT_COLUMNS}, {VARIANTS}
              from products p
              left join categories c on c.id = p.category_id
             where {clause}
             order by p.sort_order, p.name
             limit %s offset %s""",
        (*params, limit, offset),
    )
    total = db.scalar(
        f"""select count(*) from products p
            left join categories c on c.id = p.category_id
            where {clause}""",
        tuple(params),
    )

    return ok(
        {"products": to_jsonable(rows)},
        meta={"page": page, "limit": limit, "total": total},
    )


@bp.get("/products/<slug>")
def get_product(slug):
    row = db.query_one(
        f"""select {PRODUCT_COLUMNS}, {VARIANTS},
                   coalesce((
                     select json_agg(json_build_object('url', i.url, 'alt', i.alt)
                            order by i.sort_order)
                     from product_images i where i.product_id = p.id
                   ), '[]'::json) as images,
                   coalesce((
                     select json_agg(json_build_object(
                       'question', f.question, 'answer', f.answer) order by f.sort_order)
                     from faqs f where f.product_id = p.id and f.is_active
                   ), '[]'::json) as faqs
              from products p
              left join categories c on c.id = p.category_id
             where p.slug = %s and p.is_active""",
        (slug,),
    )
    if not row:
        return fail("We could not find that tea.", 404, code="product_not_found")

    row["reviews"] = db.query(
        """select author_name, rating, title, body, is_verified, created_at
             from reviews
            where product_id = %s and is_approved
            order by created_at desc limit 20""",
        (row["id"],),
    )
    return ok(to_jsonable(row))


@bp.get("/categories")
def list_categories():
    rows = db.query(
        """select c.id, c.name, c.slug, c.description, c.image_url,
                  (select count(*) from products p
                    where p.category_id = c.id and p.is_active) as product_count
             from categories c
            where c.is_active
            order by c.sort_order, c.name"""
    )
    return ok(to_jsonable(rows))


@bp.post("/products/<slug>/reviews")
@login_required
def add_review(slug):
    """
    Write a review.

    The version this replaces imported optional_auth and never applied
    it, so every review arrived with no user_id, is_verified permanently
    false, and no account required at all -- an open form for anyone who
    found the URL. Nothing rendered the reviews, which is the only
    reason it had not become a problem.

    Three rules now: you must be signed in, you must have bought the
    thing (unless an admin turns that off), and you get one review per
    product. The third is enforced by a unique index as well as the
    check below, because a double-tapped button runs both halves twice.
    """
    data = request.get_json(silent=True) or {}
    rating = data.get("rating")
    if not isinstance(rating, int) or not 1 <= rating <= 5:
        return fail("Choose a rating from 1 to 5.", 422,
                    errors={"rating": "Pick between one and five stars."})

    body = (data.get("body") or "").strip()
    if len(body) > 4000:
        return fail("That review is too long. Keep it under 4000 characters.", 422,
                    errors={"body": "Too long."})

    product = db.query_one(
        "select id, name from products where slug = %s and is_active", (slug,))
    if not product:
        return fail("We could not find that tea.", 404, code="product_not_found")

    user_id = g.user["id"]
    cfg_require = settings_service.get_bool("reviews.require_purchase", True)

    # Which order this review belongs to. Also the proof: without a
    # delivered order containing this product, there is nothing to
    # review.
    order_id = db.scalar(
        """select o.id
             from orders o
             join order_items i on i.order_id = o.id
            where o.user_id = %s
              and i.product_id = %s
              and o.status = 'delivered'
            order by o.placed_at desc
            limit 1""",
        (user_id, product["id"]),
    )

    if cfg_require and not order_id:
        return fail(
            f"Reviews come from people who have had the tea. Once your order of "
            f"{product['name']} arrives, you can write one.",
            403, code="not_purchased",
        )

    if db.scalar("select 1 from reviews where product_id = %s and user_id = %s",
                 (product["id"], user_id)):
        return fail("You have already reviewed this one. Ask us if you want it changed.",
                    409, code="already_reviewed")

    auto = settings_service.get_bool("reviews.auto_approve", False)
    name = (data.get("author_name") or g.user.get("full_name") or "A customer").strip()[:80]

    try:
        row = db.insert_returning(
            """insert into reviews
                 (product_id, user_id, order_id, author_name, rating, title, body,
                  is_verified, is_approved)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               returning id, rating, is_approved""",
            (product["id"], user_id, order_id, name, rating,
             (data.get("title") or "").strip()[:120], body,
             bool(order_id), auto),
        )
    except Exception:
        # The unique index caught a double submit. Not an error worth
        # showing as one.
        return fail("You have already reviewed this one.", 409, code="already_reviewed")

    return ok(
        to_jsonable(row),
        message=("Thank you - your review is live." if auto else
                 "Thank you. Your review will appear once we have read it."),
        status=201,
    )


@bp.get("/me/reviewable")
@login_required
def reviewable():
    """
    What this customer can review, and what they already have.

    The account page needs both: a product with no review yet gets a
    form, one already reviewed gets its rating shown back. Returning
    them together saves the page deciding from two lists.
    """
    rows = db.query(
        """select distinct on (p.id)
                  p.id, p.slug, p.name, p.hero_image,
                  o.id as order_id, o.order_number, o.delivered_at,
                  r.id as review_id, r.rating, r.is_approved, r.created_at as reviewed_at
             from orders o
             join order_items i on i.order_id = o.id
             join products p on p.id = i.product_id
             left join reviews r on r.product_id = p.id and r.user_id = %s
            where o.user_id = %s
              and o.status = 'delivered'
              and p.is_active
            order by p.id, o.delivered_at desc nulls last""",
        (g.user["id"], g.user["id"]),
    )

    # Unreviewed first: that is the list with something to do in it.
    rows.sort(key=lambda r: (r["review_id"] is not None,
                             r["delivered_at"] is None, r["name"]))
    return ok(to_jsonable(rows))
