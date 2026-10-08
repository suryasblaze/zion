import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Seo, { productSchema, faqSchema } from '../components/Seo'
import { canonical } from '../lib/site'
import { bySlug, TEAS, FAQS } from '../data/catalog'
import { useCart } from '../context/StoreProvider'
import { accentStyle, inr, discountPct } from '../lib/format'
import NotFound from './NotFound'
import Img from '../components/Img'

export default function Product() {
  const { slug } = useParams()
  const product = bySlug(slug)
  const [sizeIdx, setSizeIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const { add } = useCart()

  if (!product) return <NotFound />

  const size = product.sizes[sizeIdx]
  const off = discountPct(size.price, size.mrp)
  const others = TEAS.filter((t) => t.slug !== product.slug).slice(0, 4)

  return (
    <div style={accentStyle(product)}>
      <Seo
        title={`${product.name} Herbal Tea — Caffeine Free | ZION Herbs`}
        description={product.short}
        image={product.image}
        canonical={canonical(`/product/${product.slug}`)}
        schema={productSchema(product)}
      />

      <nav className="shell py-5 text-tiny text-soft" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink">Home</Link>
        <span className="px-2">/</span>
        <Link to="/shop" className="hover:text-ink">Shop</Link>
        <span className="px-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <section className="shell grid gap-14 pb-20 lg:grid-cols-[.95fr_1.05fr]">
        <figure className="relative m-0">
          <div className="absolute -inset-3 -z-10" style={{ background: 'rgb(var(--c-accent) / 0.07)' }} />
          <div className="border border-line bg-paper p-3">
            <Img src={product.image} alt={`ZION ${product.name} herbal tea`} className="w-full" />
          </div>
        </figure>

        <div>
          <p className="script mb-1">{product.script}</p>
          <h1 className="text-d1">{product.name}</h1>
          {product.botanical && (
            <p className="mt-2 text-lede italic text-soft">{product.botanical}</p>
          )}

          <p className="mt-6 max-w-[52ch] text-lede text-soft">{product.long}</p>

          {/* brewing spec — the detail that decides whether it tastes right */}
          {product.brew && (
            <dl className="nums my-8 grid max-w-[46ch] grid-cols-3 border-y border-line py-4 text-tiny">
              {[
                ['Water', `${product.brew.temp}°C`],
                ['Steep', `${product.brew.minutes} min`],
                ['Caffeine', 'None'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-soft">{k}</dt>
                  <dd className="mt-0.5 text-[1.05rem] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mb-6">
            <span className="label">Pack size</span>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s, i) => (
                <button
                  key={s.sku}
                  onClick={() => setSizeIdx(i)}
                  aria-pressed={i === sizeIdx}
                  className={`nums rounded border px-5 py-2.5 text-[0.92rem] transition-colors ${
                    i === sizeIdx
                      ? 'border-accent bg-accent/[0.06] text-accent-deep'
                      : 'border-line text-soft hover:border-gold hover:text-ink'
                  }`}
                >
                  {s.label} · {inr(s.price)}
                </button>
              ))}
            </div>
          </div>

          <div className="nums mb-6 flex items-baseline gap-3">
            <span className="font-display text-[2.1rem]">{inr(size.price)}</span>
            {off > 0 && (
              <>
                <s className="text-soft">{inr(size.mrp)}</s>
                <span className="text-tiny text-gold">{off}% off</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center border border-line">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3 text-soft hover:text-ink" aria-label="Reduce quantity">−</button>
              <span className="nums w-10 text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-4 py-3 text-soft hover:text-ink" aria-label="Increase quantity">+</button>
            </div>
            <button onClick={() => add(product, size, qty)} className="btn btn-solid flex-1 sm:flex-none">
              Add to bag · {inr(size.price * qty)}
            </button>
          </div>

          <p className="mt-4 text-tiny text-soft">
            Free delivery over ₹999 · Ships in 2–3 working days across Tamil Nadu
          </p>

          {product.contents && (
            <div className="mt-8 border-t border-line pt-6">
              <span className="label">In the box</span>
              <ul className="grid gap-1.5 text-soft sm:grid-cols-2">
                {product.contents.map((c) => (
                  <li key={c} className="accent-rule">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {product.benefits && (
        <section className="border-y border-line bg-surface py-20">
          <div className="shell">
            <h2 className="mb-10 text-d2">What it is taken for</h2>
            <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {product.benefits.map(([title, body]) => (
                <div key={title} className="accent-rule">
                  <h3 className="text-[1.08rem]">{title}</h3>
                  <p className="mt-1.5 max-w-[38ch] text-soft">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 max-w-[70ch] text-tiny text-soft">
              Herbal infusions are food, not medicine, and these are traditional uses rather than
              medical claims. If you are pregnant, breastfeeding or taking regular medication, ask
              your doctor before making any herb part of your routine.
            </p>
          </div>
        </section>
      )}

      <section className="py-20">
        <div className="shell">
          <h2 className="mb-8 text-d2">The rest of the six</h2>
          <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {others.map((t) => (
              <Link
                key={t.slug}
                to={`/product/${t.slug}`}
                style={accentStyle(t)}
                className="group relative flex flex-col gap-3 border-b border-r border-line bg-paper p-6 transition-colors hover:bg-surface"
              >
                <span className="absolute left-0 top-6 bottom-6 w-[2px] bg-accent" />
                <div className="overflow-hidden bg-surface">
                  <Img
                    src={t.tile || t.image}
                    alt={`ZION ${t.name}`}
                    className="aspect-square w-full object-cover transition-transform duration-700 ease-ease group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-d3">{t.name}</h3>
                <p className="nums text-tiny text-soft">{inr(t.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
