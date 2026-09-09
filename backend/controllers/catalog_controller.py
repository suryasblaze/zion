"""Public catalogue: products, variants, categories, reviews."""
from flask import Blueprint, request

import db
from utils.helpers import fail, ok, paginate_args, to_jsonable

bp = Blueprint("catalog", __name__, url_prefix="/api")

PRODUCT_COLUMNS = """
  p.id, p.name, p.slug, p.script_word, p.botanical_name, p.tagline,
  p.short_desc, p.description, p.story, p.accent_color, p.accent_soft,
  p.hero_image, p.gallery, p.benefits, p.ingredients, p.brewing, p.badges,
  p.is_caffeine_free, p.is_featured, p.rating_avg, p.rating_count, p.seo,
  p.sort_order, c.slug as category_slug, c.name as category_name
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
def add_review(slug):
    from flask import g

    from utils.auth import optional_auth

    data = request.get_json(silent=True) or {}
    rating = data.get("rating")
    if not isinstance(rating, int) or not 1 <= rating <= 5:
        return fail("Choose a rating from 1 to 5.", 422, errors={"rating": "Required."})

    product_id = db.scalar("select id from products where slug = %s and is_active", (slug,))
    if not product_id:
        return fail("We could not find that tea.", 404)

    user_id = getattr(g, "user", None) and g.user["id"]
    db.execute(
        """insert into reviews (product_id, user_id, author_name, rating, title, body)
           values (%s, %s, %s, %s, %s, %s)""",
        (product_id, user_id, (data.get("author_name") or "Verified buyer").strip()[:80],
         rating, (data.get("title") or "").strip()[:120], (data.get("body") or "").strip()),
    )
    return ok(message="Thank you. Your review will appear once we have read it.", status=201)
