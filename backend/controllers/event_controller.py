"""
Event sampling.

Public: fetch what the form should say, and submit a sign-up.
Admin:  list sign-ups, mark one claimed, see the per-flavour tally.

The claim code is the whole mechanism. Someone fills the form, gets a
short code, and shows it at the counter; staff look it up and mark it
claimed, which can only happen once. Without it, staff are trusting a
screenshot that could be shown ten times.
"""
import re
import secrets

from flask import Blueprint, g, request

import db
from services import settings_service
from utils.auth import admin_required
from utils.helpers import (client_ip, fail, hash_ip, ok, paginate_args, to_jsonable,
                           valid_email, valid_phone)

bp = Blueprint("events", __name__, url_prefix="/api/events")

# No 0/O/1/I to confuse anyone reading a code aloud across a busy counter.
CODE_ALPHABET = "23456789ACDEFGHJKLMNPQRTUVWXY"


def _event_config():
    return {
        "enabled": settings_service.get_bool("event.form_enabled", True),
        "slug": settings_service.get_str("event.slug", "default"),
        "name": settings_service.get_str("event.name", "ZION tasting"),
        "headline": settings_service.get_str("event.headline", "Pick a tea. It is on us."),
        "intro": settings_service.get_str("event.intro", ""),
        "thank_you": settings_service.get_str("event.thank_you", ""),
        "closed_message": settings_service.get_str("event.closed_message", ""),
        "collect_email": settings_service.get_bool("event.collect_email", False),
        "one_per_phone": settings_service.get_bool("event.one_per_phone", True),
    }


def _normalise_phone(raw):
    """
    Compare on digits only. Someone typing 98400 12345 at the counter and
    +91 9840012345 an hour later is the same person, and the per-phone
    limit has to see that.
    """
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[2:]
    return digits


def _new_code(cur):
    """A short code that is unique within the table."""
    for _ in range(12):
        code = "ZN-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))
        cur.execute("select 1 from event_signups where claim_code = %s", (code,))
        if not cur.fetchone():
            return code
    # Astronomically unlikely; fall back to something certainly unique.
    return "ZN-" + secrets.token_hex(4).upper()


# =====================================================================
@bp.get("/config")
def config():
    """Everything the public form needs, including what it may offer."""
    cfg = _event_config()

    products = db.query(
        """select p.id, p.name, p.slug, p.tagline, p.accent_color,
                  p.short_desc, p.botanical_name
             from products p
            where p.is_active and p.category_id =
                  (select id from categories where slug = 'single-origin')
            order by p.sort_order, p.name"""
    )
    # A fresh install, or a shop that renamed its categories, should still
    # get a usable form rather than an empty one.
    if not products:
        products = db.query(
            """select id, name, slug, tagline, accent_color, short_desc, botanical_name
                 from products where is_active order by sort_order limit 8"""
        )

    return ok({**cfg, "products": to_jsonable(products)})


@bp.post("/signup")
def signup():
    cfg = _event_config()
    if not cfg["enabled"]:
        return fail(cfg["closed_message"] or "Sampling has finished for this event.",
                    403, code="event_closed")

    data = request.get_json(silent=True) or {}
    name = (data.get("full_name") or "").strip()
    phone_raw = (data.get("phone") or "").strip()
    phone = _normalise_phone(phone_raw)
    email = (data.get("email") or "").strip().lower() or None
    slug = (data.get("product_slug") or "").strip()

    errors = {}
    if len(name) < 2:
        errors["full_name"] = "Tell us your name."
    if not phone or len(phone) < 10:
        errors["phone"] = "Enter a 10-digit mobile number."
    elif not valid_phone(phone):
        errors["phone"] = "That number does not look right."
    if not slug:
        errors["product_slug"] = "Choose the tea you would like to try."
    if email and not valid_email(email):
        errors["email"] = "That email does not look right."
    if errors:
        return fail("Check the highlighted fields.", 422, errors=errors)

    product = db.query_one(
        "select id, name, slug from products where slug = %s and is_active", (slug,)
    )
    if not product:
        return fail("That tea is not available to sample.", 422,
                    errors={"product_slug": "Choose another."})

    with db.transaction() as cur:
        # A duplicate phone gets a flat refusal with nothing in it: no
        # name, no code, no confirmation of whose number it is. This
        # endpoint is unauthenticated, and Indian mobile numbers are ten
        # digits with predictable prefixes, so echoing a stored record
        # back on a phone match would be a lookup service -- enumerate
        # numbers, harvest names and claim codes, collect the samples.
        #
        # The double-tap case it used to serve is handled on the client
        # instead: the browser keeps its own code in local storage and
        # redisplays it without asking us. Someone who genuinely lost it
        # asks staff, who can look them up by phone in the admin panel.
        # That is the right trust boundary -- a person at the counter can
        # be looked at; an HTTP request cannot.
        if cfg["one_per_phone"]:
            cur.execute(
                "select 1 from event_signups where event_slug = %s and phone = %s",
                (cfg["slug"], phone),
            )
            if cur.fetchone():
                return fail(
                    "That number is already registered for this event. If it was you, "
                    "show the code you were given earlier, or ask us at the counter.",
                    409, code="already_registered",
                )

        code = _new_code(cur)
        cur.execute(
            """insert into event_signups
                 (event_slug, event_name, full_name, phone, email,
                  product_id, product_name, product_slug,
                  claim_code, source, ip_hash, user_agent)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               returning claim_code, product_name, full_name, created_at""",
            (cfg["slug"], cfg["name"], name, phone, email,
             product["id"], product["name"], product["slug"],
             code, (data.get("source") or "link")[:32],
             hash_ip(client_ip()), (request.headers.get("User-Agent") or "")[:400]),
        )
        row = cur.fetchone()

    return ok(
        {
            **to_jsonable(row),
            "already_registered": False,
            "status": "pending",
            "thank_you": cfg["thank_you"],
            "event_name": cfg["name"],
        },
        message="You are on the list.",
        status=201,
    )


# ===================================================================== admin
@bp.get("/admin/signups")
@admin_required
def list_signups():
    page, limit, offset = paginate_args(default_limit=50, max_limit=200)
    status = request.args.get("status")
    search = request.args.get("q")
    event = request.args.get("event")

    where, params = ["1=1"], []
    if status and status != "all":
        where.append("s.status = %s")
        params.append(status)
    if event and event != "all":
        where.append("s.event_slug = %s")
        params.append(event)
    if search:
        where.append("(s.full_name ilike %s or s.phone ilike %s or s.claim_code ilike %s)")
        params += [f"%{search}%"] * 3
    clause = " and ".join(where)

    rows = db.query(
        f"""select s.id, s.full_name, s.phone, s.email, s.product_name, s.product_slug,
                   s.claim_code, s.status, s.claimed_at, s.event_slug, s.event_name,
                   s.source, s.created_at, p.accent_color
              from event_signups s
              left join products p on p.id = s.product_id
             where {clause}
             order by s.created_at desc
             limit %s offset %s""",
        (*params, limit, offset),
    )
    total = db.scalar(f"select count(*) from event_signups s where {clause}", tuple(params))

    stats = db.query_one(
        """select count(*) total,
                  count(*) filter (where status = 'pending') pending,
                  count(*) filter (where status = 'claimed') claimed,
                  count(*) filter (where created_at > now() - interval '1 day') today
             from event_signups"""
    )
    tally = db.query(
        "select * from event_signup_tally order by signups desc"
    )

    return ok(to_jsonable(rows),
              meta={"page": page, "limit": limit, "total": total},
              stats=to_jsonable(stats), tally=to_jsonable(tally))


@bp.post("/admin/signups/<signup_id>/claim")
@admin_required
def claim(signup_id):
    """
    Hand over the sample. Conditional on the row still being pending, so
    two staff scanning the same code at once cannot both succeed.
    """
    row = db.insert_returning(
        """update event_signups
              set status = 'claimed', claimed_at = now(), claimed_by = %s
            where id = %s and status = 'pending'
            returning id, full_name, product_name, claim_code, claimed_at""",
        (g.user["id"], signup_id),
    )
    if not row:
        current = db.query_one(
            "select status, full_name, claimed_at from event_signups where id = %s",
            (signup_id,),
        )
        if not current:
            return fail("That sign-up no longer exists.", 404)
        if current["status"] == "claimed":
            when = current["claimed_at"]
            return fail(
                f"{current['full_name']} already collected this"
                + (f" at {when:%H:%M on %d %b}" if when else "") + ".",
                409, code="already_claimed",
            )
        return fail(f"That sign-up is {current['status']} and cannot be claimed.", 409)

    return ok(to_jsonable(row), message=f"Handed to {row['full_name']}.")


@bp.post("/admin/signups/<signup_id>/unclaim")
@admin_required
def unclaim(signup_id):
    """Undo a claim made by mistake."""
    row = db.insert_returning(
        """update event_signups
              set status = 'pending', claimed_at = null, claimed_by = null
            where id = %s and status = 'claimed'
            returning id, full_name""",
        (signup_id,),
    )
    if not row:
        return fail("That sign-up is not marked as claimed.", 409)
    return ok(to_jsonable(row), message="Put back to pending.")


@bp.get("/admin/lookup/<term>")
@admin_required
def lookup(term):
    """
    Find a sign-up from the counter, by claim code or by phone number.

    Phone lookup is how staff help someone who has lost their code -- the
    public endpoint deliberately will not do this, because there is no way
    for it to tell who is asking. Behind an admin login there is.
    """
    term = (term or "").strip()
    digits = _normalise_phone(term)

    row = db.query_one(
        """select s.id, s.full_name, s.phone, s.product_name, s.claim_code,
                  s.status, s.claimed_at, s.created_at, p.accent_color
             from event_signups s
             left join products p on p.id = s.product_id
            where upper(s.claim_code) = upper(%s)
               or (length(%s) >= 10 and s.phone = %s)
            order by s.created_at desc
            limit 1""",
        (term, digits, digits),
    )
    if not row:
        return fail(f"No sign-up matches {term}.", 404)
    return ok(to_jsonable(row))
