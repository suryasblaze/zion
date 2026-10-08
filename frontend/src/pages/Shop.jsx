import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Seo from '../components/Seo'
import { canonical } from '../lib/site'
import { TEAS, SETS } from '../data/catalog'
import { useCart } from '../context/StoreProvider'
import { accentStyle, inr } from '../lib/format'

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'single', label: 'Single origin' },
  { key: 'sets', label: 'Gift sets' },
  { key: 'evening', label: 'For the evening' },
  { key: 'cooling', label: 'Cooling' },
]

const EVENING = ['chamomile', 'lavender', 'butterfly-pea', 'the-calm-trio']
const COOLING = ['nannari', 'hibiscus', 'aavaram-poo']

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [sort, setSort] = useState('featured')
  const filter = params.get('filter') || (params.get('category') === 'gift-sets' ? 'sets' : 'all')
  const { add } = useCart()

  const items = useMemo(() => {
    let list = [...TEAS, ...SETS]
    if (filter === 'single') list = TEAS
    if (filter === 'sets') list = SETS
    if (filter === 'evening') list = list.filter((p) => EVENING.includes(p.slug))
    if (filter === 'cooling') list = list.filter((p) => COOLING.includes(p.slug))

    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price)
    return list
  }, [filter, sort])

  return (
    <>
      <Seo
        title="Shop all herbal teas — ZION Herbs"
        description="Six caffeine-free single-origin infusions and two gift sets. Butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo, hand-packed in Tamil Nadu."
        canonical={canonical('/shop')}
      />

      <header className="border-b border-line">
        <div className="shell py-16">
          <p className="script mb-1">Everything we make</p>
          <h1 className="max-w-[18ch] text-d1">Eight tins. Six botanicals.</h1>
          <p className="mt-5 max-w-[54ch] text-lede text-soft">
            Each single-origin tin holds one plant and nothing else — no flavouring, no colour, no
            filler. The two sets exist because choosing from a product page is guesswork.
          </p>
        </div>
      </header>

      <div className="sticky top-[74px] z-30 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="shell flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setParams(f.key === 'all' ? {} : { filter: f.key })}
                className={`border-b pb-0.5 text-[0.92rem] transition-colors ${
                  filter === f.key
                    ? 'border-gold text-gold'
                    : 'border-transparent text-soft hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className="ml-auto flex items-center gap-2 text-tiny text-soft">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-line bg-paper px-2 py-1.5 text-ink focus:border-gold focus:outline-none"
            >
              <option value="featured">Featured</option>
              <option value="low">Price, low to high</option>
              <option value="high">Price, high to low</option>
            </select>
          </label>
        </div>
      </div>

      <section className="py-14">
        <div className="shell">
          <p className="nums mb-6 text-tiny text-soft">
            {items.length} {items.length === 1 ? 'product' : 'products'}
          </p>

          {items.length === 0 ? (
            <div className="border border-line py-20 text-center">
              <p className="script mb-2">Nothing here yet</p>
              <p className="text-soft">Try another filter — or see everything.</p>
              <button onClick={() => setParams({})} className="btn btn-ghost mt-5">
                Show everything
              </button>
            </div>
          ) : (
            <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <article
                  key={p.slug}
                  style={accentStyle(p)}
                  className="group relative flex flex-col gap-4 border-b border-r border-line bg-paper p-7 transition-colors duration-300 hover:bg-surface"
                >
                  <span className="absolute left-0 top-7 bottom-7 w-[2px] bg-accent" />

                  <Link to={`/product/${p.slug}`} className="overflow-hidden bg-surface">
                    <img
                      src={p.tile || p.image}
                      alt={`ZION ${p.name}`}
                      className="aspect-square w-full object-cover transition-transform duration-700 ease-ease group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  </Link>

                  <div>
                    <h2 className="text-d3">
                      <Link to={`/product/${p.slug}`}>{p.name}</Link>
                    </h2>
                    <p className="mt-0.5 text-tiny italic text-soft">
                      {p.botanical || p.tagline}
                    </p>
                  </div>

                  <p className="max-w-[40ch] text-tiny text-soft">{p.short}</p>

                  <div className="nums mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
                    <div>
                      <p className="flex items-baseline gap-2">
                        <span className="font-display text-[1.35rem]">{inr(p.price)}</span>
                        {p.mrp > p.price && <s className="text-tiny text-soft">{inr(p.mrp)}</s>}
                      </p>
                      <p className="text-micro tracking-[0.1em] text-soft">{p.sizes[0].label}</p>
                    </div>
                    <button onClick={() => add(p, p.sizes[0])} className="btn btn-ghost px-5 py-2.5 text-tiny">
                      Add to bag
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
