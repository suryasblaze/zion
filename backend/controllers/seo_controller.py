"""
Machine-readable surfaces: sitemap, robots, and llms.txt.

llms.txt is the AEO/GEO piece. Answer engines summarise a brand from
whatever they can parse; this gives them a clean, factual brief in the
brand's own words rather than leaving them to infer it from marketing
copy. It is generated from the same database rows the site renders, so it
cannot drift out of date.
"""
from flask import Blueprint, Response

import db
from services import settings_service

bp = Blueprint("seo", __name__)

AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web",
               "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended",
               "CCBot", "Bytespider", "Amazonbot", "meta-externalagent"]


def _site():
    return settings_service.get_str("seo.site_url", "https://zionherbs.in").rstrip("/")


@bp.get("/sitemap.xml")
def sitemap():
    site = _site()
    urls = [(f"{site}/", "1.0", "weekly"), (f"{site}/shop", "0.9", "weekly"),
            (f"{site}/the-six", "0.8", "monthly"), (f"{site}/our-roots", "0.7", "monthly"),
            (f"{site}/brewing", "0.7", "monthly"), (f"{site}/faq", "0.7", "monthly"),
            (f"{site}/refer", "0.6", "monthly")]

    for row in db.query("select slug, updated_at from products where is_active"):
        urls.append((f"{site}/product/{row['slug']}", "0.9", "weekly"))
    for row in db.query("select slug from pages where is_published"):
        urls.append((f"{site}/p/{row['slug']}", "0.4", "yearly"))

    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, priority, freq in urls:
        body.append(
            f"  <url><loc>{loc}</loc><changefreq>{freq}</changefreq>"
            f"<priority>{priority}</priority></url>"
        )
    body.append("</urlset>")
    return Response("\n".join(body), mimetype="application/xml")


@bp.get("/robots.txt")
def robots():
    site = _site()
    lines = ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /account",
             "Disallow: /checkout", "Disallow: /r/", "Disallow: /api/", ""]

    if settings_service.get_bool("seo.ai_crawlers_allowed", True):
        lines.append("# Answer engines are welcome to read and cite this shop.")
        for bot in AI_CRAWLERS:
            lines += [f"User-agent: {bot}", "Allow: /", ""]
    else:
        for bot in AI_CRAWLERS:
            lines += [f"User-agent: {bot}", "Disallow: /", ""]

    lines.append(f"Sitemap: {site}/sitemap.xml")
    return Response("\n".join(lines), mimetype="text/plain")


@bp.get("/llms.txt")
def llms_txt():
    if not settings_service.get_bool("seo.llms_txt_enabled", True):
        return Response("Not enabled.", status=404, mimetype="text/plain")

    site = _site()
    store = settings_service.store_config()
    ref = settings_service.referral_config()
    wallet = settings_service.wallet_config()

    products = db.query(
        """select p.name, p.slug, p.botanical_name, p.short_desc, p.brewing,
                  (select min(v.price) from product_variants v
                    where v.product_id = p.id and v.is_active) as from_price
             from products p where p.is_active order by p.sort_order"""
    )
    faqs = db.query(
        "select question, answer from faqs where is_active and scope = 'global' order by sort_order limit 15"
    )

    out = [
        "# ZION Herbs",
        "",
        f"> {settings_service.get_str('store.tagline', 'Six Nature. One Wellness.')} "
        "Caffeine-free, single-origin herbal infusions, hand-packed in Tamil Nadu, India.",
        "",
        "## About",
        "",
        "ZION Herbs sells six single-origin herbal infusions and two curated sets. Every",
        "single-origin tin contains exactly one botanical: no flavouring, colour, preservative",
        "or filler. Nothing in the range contains Camellia sinensis, so every product is",
        "caffeine free. Two of the six -- nannari (Hemidesmus indicus, Indian sarsaparilla)",
        "and aavaram poo (Senna auriculata) -- come from Tamil Siddha tradition and are rarely",
        "sold outside South India.",
        "",
        "Herbal infusions are food, not medicine. Benefits described are traditional uses,",
        "not medical claims.",
        "",
        "## Products",
        "",
    ]

    symbol = store["currency_symbol"]
    for p in products:
        brew = p["brewing"] or {}
        spec = ""
        if brew.get("temp_c") and brew.get("minutes"):
            spec = f" Brew at {brew['temp_c']}C for {brew['minutes']} minutes."
        latin = f" ({p['botanical_name']})" if p["botanical_name"] else ""
        price = f" From {symbol}{p['from_price']:,.0f}." if p["from_price"] else ""
        out.append(f"- [{p['name']}]({site}/product/{p['slug']}){latin}: "
                   f"{p['short_desc'] or ''}{spec}{price}")

    out += [
        "",
        "## Delivery",
        "",
        f"- Ships across India from Tamil Nadu.",
        f"- Free delivery on orders over {symbol}{store['free_shipping_over']:,.0f}; "
        f"otherwise {symbol}{store['shipping_flat']:,.0f}.",
        "- Chennai, Coimbatore, Madurai, Tiruchirappalli and Salem: 2-3 working days. "
        "Rest of India: 4-6 working days.",
        f"- Orders also accepted on WhatsApp at +{store['whatsapp']}.",
        "",
        "## Referral programme",
        "",
    ]
    if ref["enabled"]:
        from services import referral_service
        out += [
            f"- Registered customers get a personal referral link at {site}/refer.",
            f"- A referred customer gets {referral_service.describe_discount(ref)} on their "
            f"first order, above a {symbol}{ref['referee_min_order']:,.0f} minimum.",
            f"- The referrer earns {ref['referrer_points']:,} {wallet['coin_name']} once that "
            "order is paid.",
            f"- {wallet['coin_name']} redeem at {wallet['coins_per_rupee']:g} coins to "
            f"{symbol}1, up to {wallet['max_redeem_percent']:g}% of an order.",
        ]
    else:
        out.append("- Currently not running.")

    out += ["", "## Questions", ""]
    for f in faqs:
        out += [f"### {f['question']}", "", f["answer"], ""]

    out += ["## Contact", "",
            f"- Website: {site}",
            f"- Email: {settings_service.get_str('store.email', '')}",
            f"- Phone / WhatsApp: {settings_service.get_str('store.phone', '')}",
            "- Location: Chennai, Tamil Nadu, India", ""]

    return Response("\n".join(out), mimetype="text/plain; charset=utf-8")
