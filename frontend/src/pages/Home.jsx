import { useState } from 'react'
import { Link } from 'react-router-dom'
import Seo, { faqSchema } from '../components/Seo'
import { TEAS, SETS, FAQS } from '../data/catalog'
import { useCart, useSettings } from '../context/StoreProvider'
import { accentStyle, inr } from '../lib/format'

export default function Home() {
  const [active, setActive] = useState(0)
  const { add } = useCart()
  const { get } = useSettings()
  const tea = TEAS[active]

  const coinName = get('wallet.coin_name', 'ZION Coins')

  return (
    <>
      <Seo
        title="ZION Herbs — Caffeine-Free Herbal Teas from Tamil Nadu"
        description="Six single-origin herbal infusions — butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo. Whole flowers and roots, nothing added."
        image="/brand/range-poster-light.jpg"
        canonical="https://zionherbs.in/"
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
            <div className="border border-line bg-paper p-3">
              <img
                key={tea.slug}
                src={tea.image}
                alt={`ZION ${tea.name} herbal tea`}
                width="1100"
                height="1650"
                className="w-full animate-rise"
                loading="eager"
              />
            </div>
            <figcaption className="mt-3 text-center text-tiny italic text-soft">
              {tea.botanical}
            </figcaption>
          </figure>
        </div>

        {/* the six as a colour spectrum — the selector for everything above */}
        <div className="shell">
          <div
            className="grid border-t border-line sm:grid-cols-3 lg:grid-cols-6"
            role="tablist"
            aria-label="Choose an infusion"
          >
            {TEAS.map((t, i) => (
              <button
                key={t.slug}
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`group border-b border-line px-4 py-5 text-left transition-colors duration-300
                            lg:border-b-0 lg:border-r lg:last:border-r-0
                            ${i === active ? 'bg-surface' : 'hover:bg-surface/60'}`}
              >
                <span
                  className="block rounded-full transition-all duration-300"
                  style={{
                    background: t.accent,
                    height: i === active ? 6 : 3,
                    opacity: i === active ? 1 : 0.45,
                  }}
                />
                <span
                  className={`mt-3 block text-[0.92rem] transition-colors ${
                    i === active ? 'text-ink' : 'text-soft group-hover:text-ink'
                  }`}
                >
                  {t.name}
                </span>
                <span className="mt-0.5 block text-micro uppercase text-soft">{t.cup}</span>
              </button>
            ))}
          </div>
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

          <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {[...TEAS, ...SETS].map((p) => (
              <ProductCard key={p.slug} product={p} onAdd={() => add(p, p.sizes[0])} />
            ))}
          </div>
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
                    <img
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
            <img
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

function ProductCard({ product, onAdd }) {
  return (
    <article
      style={accentStyle(product)}
      className="group relative flex flex-col gap-3 border-b border-r border-line bg-paper p-6 transition-colors duration-300 hover:bg-surface"
    >
      <span className="absolute left-0 top-6 bottom-6 w-[2px] bg-accent" />

      <Link to={`/product/${product.slug}`} className="block overflow-hidden bg-surface">
        <img
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

      <div className="mt-auto flex items-end justify-between gap-3 pt-2">
        <p className="nums flex items-baseline gap-2">
          <span className="font-display text-[1.35rem]">{inr(product.price)}</span>
          {product.mrp > product.price && (
            <s className="text-tiny text-soft">{inr(product.mrp)}</s>
          )}
        </p>
        <button
          onClick={onAdd}
          className="text-tiny text-accent-deep underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          Add to bag
        </button>
      </div>
    </article>
  )
}
