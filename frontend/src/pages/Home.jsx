import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo, { faqSchema } from '../components/Seo'
import { canonical } from '../lib/site'
import ProductDetailPanel from '../components/ProductDetailPanel'
import { TEAS, SETS, FAQS } from '../data/catalog'
import { useCart, useSettings } from '../context/StoreProvider'
import { accentStyle, inr } from '../lib/format'
import Img, { preloadSrc } from '../components/Img'

const SLIDE_MS = 5000

/**
 * How many product cards sit on a row right now, matching the grid's own
 * breakpoints. The detail panel is rendered after the row that holds the
 * open card, so this has to agree with the CSS: chunking by a fixed four
 * meant that on a phone -- one card per row -- tapping the first card
 * opened the panel three cards further down, off screen, which read as
 * the button doing nothing.
 */
function useColumns() {
  const read = () => {
    if (typeof window === 'undefined') return 4
    if (window.matchMedia('(min-width: 1024px)').matches) return 4   // lg
    if (window.matchMedia('(min-width: 640px)').matches) return 2    // sm
    return 1
  }

  const [cols, setCols] = useState(read)

  useEffect(() => {
    const queries = ['(min-width: 1024px)', '(min-width: 640px)'].map((q) =>
      window.matchMedia(q)
    )
    const onChange = () => setCols(read())
    queries.forEach((q) => q.addEventListener('change', onChange))
    return () => queries.forEach((q) => q.removeEventListener('change', onChange))
  }, [])

  return cols
}

export default function Home() {
  const [active, setActive] = useState(0)
  const [openSlug, setOpenSlug] = useState(null)
  const { add } = useCart()
  const { get } = useSettings()
  const tea = TEAS[active]

  const coinName = get('wallet.coin_name', 'ZION Coins')

  // On a phone the panel can still open below the fold once the card is
  // mid-screen. Bring it up, but only on an actual open, and never
  // against someone who has asked for reduced motion.
  useEffect(() => {
    if (!openSlug) return
    const el = document.getElementById(`detail-${openSlug}`)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }, [openSlug])

  const cols = useColumns()
  const all = [...TEAS, ...SETS]
  const rows = []
  for (let i = 0; i < all.length; i += cols) rows.push(all.slice(i, i + cols))

  const go = (step) => setActive((i) => (i + step + TEAS.length) % TEAS.length)

  // The hero swaps src every few seconds. Without this the first pass
  // through the six shows a blank frame while each poster downloads,
  // because only the first one is in cache.
  useEffect(() => {
    TEAS.forEach((t) => {
      const img = new Image()
      // Must ask for the same file <picture> will choose. Preloading the
      // JPEG while the markup renders the WebP downloads every hero
      // twice and warms a cache entry nothing goes on to read.
      img.src = preloadSrc(t.image)
    })
  }, [])

  // Keyed on `active`, so the clock restarts whenever the slide changes.
  // Pressing an arrow therefore buys a full interval on the new slide,
  // instead of being cut short by a timer that was already running.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setTimeout(() => go(1), SLIDE_MS)
    return () => clearTimeout(id)
  }, [active])

  return (
    <>
      <Seo
        title="ZION Herbs — Caffeine-Free Herbal Teas from Tamil Nadu"
        description="Six single-origin herbal infusions — butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo. Whole flowers and roots, nothing added."
        image="/brand/range-poster-light.jpg"
        canonical={canonical('/')}
        schema={faqSchema(FAQS.slice(0, 6))}
      />

      {/* ============================================ hero: the spectrum */}
      <section style={accentStyle(tea)} className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] transition-colors duration-700"
          style={{
            background:
              'radial-gradient(90% 70% at 72% 12%, rgb(var(--c-accent)) 0%, transparent 62%)',
          }}
        />

        <div className="shell relative grid items-center gap-14 pt-16 pb-4 lg:grid-cols-[1.05fr_.95fr] lg:pt-20">
          <div>
            <p className="script mb-1">Six nature, one wellness</p>
            <h1 className="text-d1">
              The whole flower.
              <br />
              Nothing else in the tin.
            </h1>

            <p className="mt-6 max-w-[46ch] text-lede text-soft">{tea.long}</p>

            <dl className="nums my-8 flex max-w-[52ch] flex-wrap gap-x-7 gap-y-2 border-y border-line py-4 text-tiny text-soft">
              <div className="flex gap-2">
                <dt>Brew</dt>
                <dd className="text-ink">{tea.brew.temp}°C</dd>
              </div>
              <div className="flex gap-2">
                <dt>Steep</dt>
                <dd className="text-ink">{tea.brew.minutes} min</dd>
              </div>
              <div className="flex gap-2">
                <dt>Caffeine</dt>
                <dd className="text-ink">none</dd>
              </div>
              <div className="flex gap-2">
                <dt>From</dt>
                <dd className="text-ink">{inr(tea.price)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => add(tea, tea.sizes[0])} className="btn btn-solid">
                Add {tea.name} · {inr(tea.price)}
              </button>
              <Link to="/product/the-six-discovery-box" className="btn btn-ghost">
                Try all six · {inr(1499)}
              </Link>
            </div>
          </div>

          <figure className="relative m-0 justify-self-center w-full max-w-[400px]">
            <div
              className="absolute -inset-3 -z-10 transition-colors duration-700"
              style={{ background: 'rgb(var(--c-accent) / 0.07)' }}
            />
            <div className="relative border border-line bg-paper p-3">
              <Img
                key={tea.slug}
                src={tea.image}
                alt={`ZION ${tea.name} herbal tea`}
                width="1100"
                height="1650"
                className="w-full animate-rise"
                priority
              />

              {/* Deliberately faint. The hero moves on its own; these are
                  only for someone who wants to go back or skip ahead, and
                  pressing one does not stop the rotation. */}
              <button
                onClick={() => go(-1)}
                aria-label="Previous tea"
                className="absolute left-0 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2
                           place-items-center rounded-full text-ink opacity-35
                           transition-all duration-300 hover:bg-paper/70 hover:opacity-100
                           hover:backdrop-blur-sm focus-visible:opacity-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>

              <button
                onClick={() => go(1)}
                aria-label="Next tea"
                className="absolute right-0 top-1/2 grid h-11 w-11 translate-x-1/2 -translate-y-1/2
                           place-items-center rounded-full text-ink opacity-35
                           transition-all duration-300 hover:bg-paper/70 hover:opacity-100
                           hover:backdrop-blur-sm focus-visible:opacity-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <figcaption className="mt-3 flex items-center justify-center gap-2 text-tiny italic text-soft">
              {tea.botanical}
              <span className="not-italic text-micro">
                · {active + 1} of {TEAS.length}
              </span>
            </figcaption>
          </figure>
        </div>

      </section>

      {/* ================================================= the shelf */}
      <section className="py-24" id="shop">
        <div className="shell">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <h2 className="text-d2">Six single-origin infusions</h2>
            <p className="max-w-[44ch] text-soft">
              One botanical in each tin, nothing added. Two of them — nannari root and aavaram
              poo — you will not find outside Tamil Nadu.
            </p>
          </div>

          {/* Each row of cards is followed by the open panel, so the detail
              appears directly beneath the product you clicked rather than
              pushing the grid apart mid-row. */}
          {rows.map((row, rowIndex) => {
            const openInRow = row.find((p) => p.slug === openSlug)
            return (
              <div key={rowIndex}>
                <div
                  className={`grid border-l border-line sm:grid-cols-2 lg:grid-cols-4
                              ${rowIndex === 0 ? 'border-t' : ''}`}
                >
                  {row.map((p) => (
                    <ProductCard
                      key={p.slug}
                      product={p}
                      open={p.slug === openSlug}
                      onToggle={() => setOpenSlug(openSlug === p.slug ? null : p.slug)}
                      onAdd={() => add(p, p.sizes[0])}
                    />
                  ))}
                </div>

                {openInRow && (
                  <ProductDetailPanel
                    id={`detail-${openInRow.slug}`}
                    product={openInRow}
                    onAdd={() => add(openInRow, openInRow.sizes[0])}
                    onClose={() => setOpenSlug(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ================================================= tamil roots */}
      <section className="border-y border-line bg-surface py-24">
        <div className="shell grid items-center gap-16 lg:grid-cols-2">
          <div>
            <p className="font-display text-[1.3rem] tracking-wide text-gold">
              நன்னாரி &nbsp;·&nbsp; ஆவாரம் பூ
            </p>
            <h2 className="mt-3 text-d2">Two of these belong to the medicine cabinet, not the tea aisle</h2>

            <p className="mt-6 max-w-[56ch] text-soft">
              Nannari is the root of <em>Hemidesmus indicus</em>, Indian sarsaparilla. Every Tamil
              household knows it as the sherbet you drink when the heat becomes unreasonable.
              Aavaram poo is the yellow flower of <em>Senna auriculata</em>, used in Siddha practice
              for generations, particularly around blood sugar and skin.
            </p>
            <p className="mt-4 max-w-[56ch] text-soft">
              Neither is exotic to us. What is new is putting them in a tin at the standard the rest
              of the world reserves for Darjeeling — whole root, coarse cut, hand-sorted flowers,
              and a printed brewing time that actually works.
            </p>

            <div className="mt-9 grid gap-6 sm:grid-cols-2">
              {[TEAS[4], TEAS[5]].map((t) => (
                <figure key={t.slug} className="m-0" style={accentStyle(t)}>
                  <Link to={`/product/${t.slug}`}>
                    <Img
                      src={t.image}
                      alt={`ZION ${t.name}`}
                      className="border border-line"
                      loading="lazy"
                    />
                  </Link>
                  <figcaption className="accent-rule mt-3 text-tiny text-soft">
                    <span className="block text-ink">{t.name}</span>
                    {t.brew.temp}°C · {t.brew.minutes} min
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          <figure className="m-0">
            <Img
              src="/products/lavender-tin.jpg"
              alt="The ZION lavender herbal infusion tin"
              className="border border-line"
              loading="lazy"
            />
            <figcaption className="mt-3 text-tiny italic text-soft">
              Packed in Tamil Nadu. Resealable tin, no plastic sachets.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ================================================= referral */}
      <section className="py-24">
        <div className="shell grid items-center gap-16 lg:grid-cols-[.85fr_1.15fr]">
          <div className="relative grid min-h-[290px] place-items-center">
            <span className="absolute h-[320px] w-[320px] rounded-full border border-gold-lit opacity-20" />
            <span className="absolute h-[258px] w-[258px] rounded-full border border-gold-lit opacity-40" />
            <span
              className="grid h-[190px] w-[190px] place-items-center rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 34% 28%, #EBD08A, #C8A44D 46%, #8A6C24 100%)',
                boxShadow: '0 18px 44px rgba(200,164,77,0.28)',
              }}
            >
              <span className="font-display text-[1.85rem] tracking-[0.14em] text-ink">ZION</span>
            </span>
          </div>

          <div>
            <h2 className="text-d2">Send a friend a pot, keep the coins</h2>
            <p className="mt-4 max-w-[52ch] text-soft">
              Every account gets its own link. Your friend saves on their first order, and you
              collect {coinName} that come straight off your next one.
            </p>

            <ol className="mt-8 border-t border-line">
              {[
                ['Share your link', 'Waiting in your account the moment you register. We count every click.'],
                ['They save 10% on their first order', 'Applied at checkout automatically, up to ₹300 off.'],
                [`You collect 200 ${coinName}`, 'Credited when their order is paid. 10 coins is ₹1.'],
              ].map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[34px_1fr] gap-4 border-b border-line py-5">
                  <span className="nums font-display text-gold">0{i + 1}</span>
                  <div>
                    <h3 className="text-[1.05rem]">{title}</h3>
                    <p className="mt-1 text-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link to="/refer" className="btn btn-gold">
                Get my link
              </Link>
              <span className="text-tiny text-soft">
                Discount and coin rates are set in the admin panel, changeable any time.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================= faq */}
      <section className="border-t border-line py-24">
        <div className="shell">
          <h2 className="mb-10 text-d2">Questions we actually get</h2>
          <div className="max-w-[820px]">
            {FAQS.slice(0, 6).map((f) => (
              <details key={f.q} className="group border-b border-line py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                  <h3 className="text-[1.1rem]">{f.q}</h3>
                  <span className="mt-1 shrink-0 text-gold transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[66ch] text-soft">{f.a}</p>
              </details>
            ))}
          </div>
          <Link
            to="/faq"
            className="mt-8 inline-block border-b border-gold pb-0.5 text-gold transition-opacity hover:opacity-70"
          >
            All questions
          </Link>
        </div>
      </section>
    </>
  )
}

function ProductCard({ product, onAdd, open, onToggle }) {
  return (
    <article
      style={accentStyle(product)}
      className={`group relative flex flex-col gap-3 border-b border-r border-line p-6
                  transition-colors duration-300
                  ${open ? 'bg-surface' : 'bg-paper hover:bg-surface'}`}
    >
      <span className="absolute left-0 top-6 bottom-6 w-[2px] bg-accent" />

      <Link to={`/product/${product.slug}`} className="block overflow-hidden bg-surface">
        <Img
          src={product.tile || product.image}
          alt={`ZION ${product.name}`}
          className="aspect-square w-full object-cover transition-transform duration-700 ease-ease group-hover:scale-[1.04]"
          loading="lazy"
        />
      </Link>

      <div>
        <h3 className="text-d3">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className="text-tiny text-soft">{product.tagline}</p>
      </div>

      <p className="nums border-t border-line pt-3 text-tiny text-soft">
        {product.isSet
          ? product.sizes[0].label
          : `${product.brew.temp}°C · ${product.brew.minutes} min · caffeine free`}
      </p>

      <div className="mt-auto pt-2">
        <p className="nums flex items-baseline gap-2">
          <span className="font-display text-[1.35rem]">{inr(product.price)}</span>
          {product.mrp > product.price && (
            <s className="text-tiny text-soft">{inr(product.mrp)}</s>
          )}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            onClick={onToggle}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-tiny text-ink transition-colors hover:text-gold"
          >
            {open ? 'Hide details' : 'See details'}
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" aria-hidden="true"
              className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            >
              <path d="M5 9l7 7 7-7" />
            </svg>
          </button>

          <button
            onClick={onAdd}
            className="text-tiny text-accent-deep underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Add to bag
          </button>
        </div>
      </div>
    </article>
  )
}
