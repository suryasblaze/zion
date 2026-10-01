import { useState } from 'react'
import { Link } from 'react-router-dom'
import { accentStyle, inr } from '../lib/format'

/**
 * The expanded product panel on the home page.
 *
 * Sections open one at a time, in a fixed order, so comparing two teas
 * means opening the same row on each rather than scrolling past
 * everything. The image, price and Add to bag stay put on the left: the
 * buy action should never be something you have to expand to reach.
 *
 * A section with nothing behind it is omitted rather than shown empty --
 * the gift sets have no single brewing temperature, and an empty "How to
 * brew" row reads as a bug.
 */
export default function ProductDetailPanel({ product, onAdd, onClose }) {
  const sizes = product.sizes || []
  const sections = buildSections(product)
  const [openKey, setOpenKey] = useState(sections[0]?.key ?? null)

  return (
    <div
      style={accentStyle(product)}
      className="border-t border-line bg-surface px-6 py-7 sm:px-8"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr]">
        {/* ------------------------------------------- image + buy */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Link
            to={`/product/${product.slug}`}
            className="block overflow-hidden border border-line bg-paper"
          >
            <img
              src={product.tile || product.image}
              alt={`ZION ${product.name}`}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
          </Link>

          <div className="mt-4 border-t border-line pt-4">
            <p className="nums flex items-baseline gap-2">
              <span className="font-display text-[1.6rem]">{inr(product.price)}</span>
              {product.mrp > product.price && (
                <s className="text-tiny text-soft">{inr(product.mrp)}</s>
              )}
              <span className="text-tiny text-soft">{sizes[0]?.label}</span>
            </p>

            {sizes.length > 1 && (
              <p className="nums mt-1 text-tiny text-soft">
                also {sizes.slice(1).map((s) => `${s.label} ${inr(s.price)}`).join(' · ')}
              </p>
            )}

            <button onClick={onAdd} className="btn btn-solid mt-4 w-full">
              Add to bag
            </button>
            <Link
              to={`/product/${product.slug}`}
              className="mt-2 block text-center text-tiny text-soft underline underline-offset-4 hover:text-ink"
            >
              Open the full page
            </Link>
          </div>
        </div>

        {/* ------------------------------------------- the accordion */}
        <div>
          <header className="pb-1">
            <h3 className="text-d3">{product.name}</h3>
            {product.botanical && (
              <p className="text-tiny italic text-soft">{product.botanical}</p>
            )}
            <p className="mt-2 max-w-[62ch] text-soft">{product.short}</p>
          </header>

          <div className="mt-5 border-t border-line">
            {sections.map((s) => {
              const open = openKey === s.key
              return (
                <section key={s.key} className="border-b border-line">
                  <h4>
                    <button
                      onClick={() => setOpenKey(open ? null : s.key)}
                      aria-expanded={open}
                      aria-controls={`sec-${product.slug}-${s.key}`}
                      className="flex w-full items-center justify-between gap-4 py-3.5 text-left
                                 transition-colors hover:text-gold"
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="h-4 w-[2px] shrink-0 transition-opacity duration-300"
                          style={{ background: 'rgb(var(--c-accent))', opacity: open ? 1 : 0.25 }}
                        />
                        <span className="text-[0.98rem]">{s.title}</span>
                      </span>
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" aria-hidden="true"
                        className={`shrink-0 text-soft transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                      >
                        <path d="M5 9l7 7 7-7" />
                      </svg>
                    </button>
                  </h4>

                  <div
                    id={`sec-${product.slug}-${s.key}`}
                    hidden={!open}
                    className="pb-5 pl-5 animate-rise"
                  >
                    {s.body}
                  </div>
                </section>
              )
            })}
          </div>

          <button
            onClick={onClose}
            className="mt-5 text-tiny text-soft underline underline-offset-4 hover:text-ink"
          >
            Close details
          </button>
        </div>
      </div>
    </div>
  )
}

/* Built as data so the order is stated once and empty ones drop out. */
function buildSections(product) {
  const brew = product.brew
  const out = []

  out.push({
    key: 'inside',
    title: "What's inside",
    body: product.contents ? (
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {product.contents.map((c) => (
          <li key={c} className="text-soft">· {c}</li>
        ))}
      </ul>
    ) : (
      <p className="max-w-[62ch] text-soft">
        {product.botanical ? `${product.botanical}. ` : ''}
        One botanical and nothing else — no flavouring, colour, preservative or filler.
      </p>
    ),
  })

  if (product.benefits?.length) {
    out.push({
      key: 'benefits',
      title: 'Health benefits',
      body: (
        <>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {product.benefits.map(([title, body]) => (
              <li key={title}>
                <span className="block text-[0.95rem] text-ink">{title}</span>
                <span className="block text-tiny text-soft">{body}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-micro text-soft">
            Traditional uses, not medical claims. Ask your doctor if you are pregnant,
            breastfeeding or on medication.
          </p>
        </>
      ),
    })
  }

  out.push({
    key: 'brew',
    title: 'How to brew',
    body: brew ? (
      <>
        <dl className="nums mb-2 flex flex-wrap gap-x-8 gap-y-1 text-tiny">
          <Spec k="Water" v={`${brew.temp}°C`} />
          <Spec k="Steep" v={`${brew.minutes} min`} />
          <Spec k="Leaf" v="1 heaped tsp per 200 ml" />
        </dl>
        <p className="max-w-[62ch] text-soft">
          Cover the cup while it steeps, and strain on time — every one of these turns bitter
          if you forget it.
        </p>
      </>
    ) : (
      <p className="max-w-[62ch] text-soft">
        Each tea in the box brews differently. The card packed inside gives the temperature
        and time for every one.
      </p>
    ),
  })

  if (product.taste) {
    out.push({
      key: 'taste',
      title: 'Taste and aroma',
      body: <p className="max-w-[62ch] text-soft">{product.taste}</p>,
    })
  }

  if (product.nutrition?.length) {
    out.push({
      key: 'nutrition',
      title: 'Nutritional facts',
      body: (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {product.nutrition.map((n) => (
            <li key={n} className="text-soft">· {n}</li>
          ))}
        </ul>
      ),
    })
  }

  if (product.origin) {
    out.push({
      key: 'origin',
      title: 'Origin and source',
      body: <p className="max-w-[62ch] text-soft">{product.origin}</p>,
    })
  }

  if (product.love?.length) {
    out.push({
      key: 'love',
      title: "Why you'll love it",
      body: (
        <ul className="grid gap-1.5">
          {product.love.map((l) => (
            <li key={l} className="text-soft">· {l}</li>
          ))}
        </ul>
      ),
    })
  }

  return out
}

function Spec({ k, v }) {
  return (
    <div className="flex gap-2">
      <dt className="text-soft">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  )
}
