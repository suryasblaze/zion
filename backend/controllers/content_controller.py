"""Public content the storefront reads: settings, theme, navigation, FAQs, pages."""
from flask import Blueprint, request

import db
from services import settings_service
from utils.helpers import fail, ok, to_jsonable, valid_email

bp = Blueprint("content", __name__, url_prefix="/api")


@bp.get("/settings")
def public_settings():
    """Everything the storefront needs to render, in one request."""
    theme = db.query_one(
        "select name, slug, tokens from theme_presets where is_active limit 1"
    )
    nav = db.query(
        "select menu, label, href, badge, is_external from nav_items where is_active order by menu, sort_order"
    )
    menus = {}
    for item in nav:
        menus.setdefault(item["menu"], []).append(item)

    return ok({
        "settings": settings_service.public_settings(),
        "theme": to_jsonable(theme),
        "menus": to_jsonable(menus),
    })


@bp.get("/faqs")
def faqs():
    scope = request.args.get("scope", "global")
    rows = db.query(
        """select question, answer, category
             from faqs
            where is_active and (scope = %s or %s = 'all')
            order by sort_order, question""",
        (scope, scope),
    )
    return ok(to_jsonable(rows))


@bp.get("/pages/<slug>")
def page(slug):
    row = db.query_one(
        """select slug, title, excerpt, body, hero_image, page_type, seo,
                  published_at, author, read_minutes
             from pages where slug = %s and is_published""",
        (slug,),
    )
    if not row:
        return fail("We could not find that page.", 404)
    return ok(to_jsonable(row))


@bp.get("/sections/<page_name>")
def sections(page_name):
    rows = db.query(
        """select section_key, component, eyebrow, title, subtitle, body,
                  media, items, cta, settings
             from page_sections
            where page = %s and is_active
            order by sort_order""",
        (page_name,),
    )
    return ok(to_jsonable(rows))


@bp.get("/testimonials")
def testimonials():
    rows = db.query(
        """select author, role, city, quote, rating, avatar_url
             from testimonials where is_active order by sort_order limit 24"""
    )
    return ok(to_jsonable(rows))


@bp.post("/contact")
def contact():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    message = (data.get("message") or "").strip()

    errors = {}
    if not name:
        errors["name"] = "Tell us your name."
    if not valid_email(email):
        errors["email"] = "Enter a valid email so we can reply."
    if len(message) < 10:
        errors["message"] = "Tell us a little more."
    if errors:
        return fail("Check the highlighted fields.", 422, errors=errors)

    db.execute(
        """insert into contact_messages (name, email, phone, subject, message)
           values (%s,%s,%s,%s,%s)""",
        (name[:120], email, (data.get("phone") or "").strip()[:20],
         (data.get("subject") or "").strip()[:160], message[:4000]),
    )
    return ok(message="Thank you. We reply within one working day.", status=201)


@bp.post("/subscribe")
def subscribe():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not valid_email(email):
        return fail("That address does not look right. Check the spelling.", 422,
                    errors={"email": "Not a valid address."})

    db.execute(
        """insert into newsletter_subscribers (email, name, source)
           values (%s,%s,%s)
           on conflict (email) do update set is_subscribed = true""",
        (email, (data.get("name") or "").strip()[:120], data.get("source") or "footer"),
    )
    return ok(message="You are on the list. First note next month.", status=201)
