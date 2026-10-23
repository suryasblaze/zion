/**
 * Turn an API product into the shape the storefront pages read.
 *
 * The pages were written against src/data/catalog.js, a hand-written
 * file, and the API grew its own names: hero_image where the pages say
 * image, short_desc where they say short, benefits as objects where they
 * expect pairs. Nobody noticed the divergence because the pages went on
 * importing the file -- so the admin panel wrote to Postgres and the
 * shop rendered a copy baked into the bundle. Editing a product changed
 * nothing a customer could see.
 *
 * This is the seam between the two. It belongs here rather than in each
 * page, because the next person to add a field should have one place to
 * add it to.
 */

/**
 * The square crop used on cards.
 *
 * The seeded artwork ships as a pair -- butterfly-pea.jpg for the hero
 * and butterfly-pea-tile.jpg cropped square -- and the card wants the
 * tile: it is a third of the bytes at the size it renders. An uploaded
 * image has no such pair, so it is used as it is; `object-cover` on the
 * card handles the crop.
 */
function tileFor(hero, gallery) {
  if (Array.isArray(gallery) && gallery.length) return gallery[0]
  if (!hero) return hero
  const local = /^\/products\/[^/]+\.(jpe?g|png|webp)$/i
  return local.test(hero) ? hero.replace(/(\.[a-z]+)$/i, '-tile$1') : hero
}

/** Benefits arrive as {title, body}; the panel renders [title, body]. */
function pairs(benefits) {
  if (!Array.isArray(benefits)) return []
  return benefits
    .map((b) => (Array.isArray(b) ? b : [b?.title, b?.body]))
    .filter(([title]) => title)
}

/**
 * Brewing, when there is a single answer.
 *
 * A gift set brews six different ways, so its row has steps but no
 * temperature. Returning null there is deliberate: the detail panel
 * drops a section with nothing behind it, and "How to brew: —" reads as
 * a bug rather than as a box of six teas.
 */
function brewOf(brewing) {
  const t = brewing?.temp_c
  const m = brewing?.minutes
  return t && m ? { temp: t, minutes: m } : null
}

/**
 * Nutrition, flattened to the list the panel renders.
 *
 * The database stores it structured -- {serving, calories, sugar,
 * caffeine, notes[]} -- and the panel prints a bullet per line. Passed
 * through as an object it has no `.length`, so the panel's "skip an
 * empty section" check would quietly drop the whole thing: present in
 * the data, absent on the page, and nothing in between to notice.
 *
 * Serving leads, because "0 kcal" means nothing without "per 200 ml".
 */
function nutritionLines(n) {
  if (!n) return null
  if (Array.isArray(n)) return n.length ? n : null

  const lines = []
  const serving = n.serving ? ` per ${n.serving}` : ''
  if (n.calories) lines.push(`${n.calories}${serving}`)
  else if (n.serving) lines.push(`Serving ${n.serving}`)
  if (n.sugar) lines.push(`Sugar ${n.sugar}`)
  if (n.caffeine) lines.push(`Caffeine ${n.caffeine.toLowerCase()}`)
  if (Array.isArray(n.notes)) lines.push(...n.notes)

  return lines.length ? lines : null
}

export function productFromApi(p) {
  if (!p) return null

  const sizes = (p.sizes || []).map((s) => ({
    label: s.label,
    price: Number(s.price) || 0,
    mrp: Number(s.compare_at_price) || 0,
    sku: s.sku,
    stock: s.stock,
  }))
  const first = sizes[0] || {}

  return {
    slug: p.slug,
    name: p.name,
    script: p.script_word,
    botanical: p.botanical_name,
    tagline: p.tagline,
    short: p.short_desc,
    description: p.description,
    story: p.story,

    image: p.hero_image,
    tile: tileFor(p.hero_image, p.gallery),
    gallery: Array.isArray(p.gallery) ? p.gallery : [],

    price: first.price || 0,
    mrp: first.mrp || 0,
    sizes,

    brew: brewOf(p.brewing),
    steps: p.brewing?.steps || [],
    iced: p.brewing?.iced || null,

    contents: p.ingredients || null,
    benefits: pairs(p.benefits),
    badges: p.badges || [],

    // The four that migration 005 added and the API had been leaving
    // out. Empty rather than undefined, so the panel's "omit a section
    // with nothing in it" check behaves the same for both sources.
    taste: p.taste_aroma || null,
    origin: p.origin || null,
    nutrition: nutritionLines(p.nutrition),
    love: p.why_love || null,

    accent: p.accent_color,
    accentSoft: p.accent_soft,

    // Pages branch on this to hide per-cup brewing on a box of six.
    isSet: p.category_slug === 'gift-sets',

    caffeineFree: p.is_caffeine_free,
    featured: p.is_featured,
  }
}

/**
 * Split a catalogue into the two lists the pages take.
 *
 * Returns null when there is nothing usable, which is the caller's cue
 * to keep the bundled copy rather than render an empty shop.
 */
export function splitCatalogue(apiProducts) {
  if (!Array.isArray(apiProducts) || apiProducts.length === 0) return null

  const mapped = apiProducts.map(productFromApi).filter(Boolean)
  return {
    teas: mapped.filter((p) => !p.isSet),
    sets: mapped.filter((p) => p.isSet),
  }
}
