import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import { TEAS } from '../data/catalog'
import { accentStyle } from '../lib/format'

export default function OurRoots() {
  return (
    <>
      <Seo
        title="Our roots — herbal tea from Tamil Nadu | ZION Herbs"
        description="Why ZION makes nannari, aavaram poo and four other single-origin infusions in Tamil Nadu, and what Siddha tradition has to do with it."
        canonical="https://zionherbs.in/our-roots"
      />

      <header className="border-b border-line">
        <div className="shell py-16">
          <p className="script mb-1">Where these come from</p>
          <h1 className="max-w-[22ch] text-d1">Tamil Nadu grows most of this already</h1>
          <p className="mt-5 max-w-[58ch] text-lede text-soft">
            Hibiscus grows in gardens here. Nannari root turns up in every summer sherbet. Aavaram
            poo is scrub on the roadside in the dry districts. None of it is exotic to us — it just
            was never packed properly.
          </p>
        </div>
      </header>

      <section className="py-16">
        <div className="shell grid gap-14 lg:grid-cols-2">
          <div>
            <h2 className="text-d2">What we changed</h2>
            <p className="mt-5 max-w-[56ch] text-soft">
              Most herbal tea sold here is dust. Broken petals and stem, milled fine so it brews
              fast and looks like a lot in the packet, sold in paper sachets that let the aroma out
              within weeks. It is cheap for a reason, and it tastes like it.
            </p>
            <p className="mt-4 max-w-[56ch] text-soft">
              We buy whole. Whole chamomile flower heads, whole butterfly pea blooms, nannari root
              cut coarse rather than powdered. It costs more per kilo and takes up more space in a
              tin, and it is the entire difference in the cup.
            </p>
            <p className="mt-4 max-w-[56ch] text-soft">
              Then we print a brewing time that works. Not "steep 3–5 minutes" on every packet
              regardless of what is inside — an actual temperature and an actual time, tested, per
              plant.
            </p>
          </div>

          <figure className="m-0">
            <img
              src="/brand/range-poster-light.jpg"
              alt="The six ZION herbal teas"
              className="border border-line"
              loading="lazy"
            />
            <figcaption className="mt-3 text-tiny italic text-soft">
              Six flavours, six benefits — the range as it ships today.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-20">
        <div className="shell">
          <p className="font-display text-[1.3rem] tracking-wide text-gold">சித்த மருத்துவம்</p>
          <h2 className="mt-3 max-w-[24ch] text-d2">The two nobody outside Tamil Nadu is selling</h2>
          <p className="mt-5 max-w-[62ch] text-soft">
            Nannari and aavaram poo both come out of Siddha practice, one of the oldest systems of
            medicine still in daily use anywhere. We are not making medical claims about either —
            they are food. But it would be strange to sell them without saying where they come from,
            and stranger still to translate their names away.
          </p>

          <div className="mt-10 grid border-l border-t border-line sm:grid-cols-2">
            {[TEAS[4], TEAS[5]].map((t) => (
              <article key={t.slug} style={accentStyle(t)} className="relative border-b border-r border-line bg-surface p-8">
                <span className="absolute left-0 top-8 bottom-8 w-[2px] bg-accent" />
                <p className="font-display text-[1.5rem] text-accent-deep">{t.tamil}</p>
                <h3 className="mt-1 text-d3">{t.name}</h3>
                <p className="text-tiny italic text-soft">{t.botanical}</p>
                <p className="mt-4 max-w-[44ch] text-soft">{t.long}</p>
                <Link
                  to={`/product/${t.slug}`}
                  className="mt-5 inline-block border-b border-gold pb-0.5 text-gold transition-opacity hover:opacity-70"
                >
                  See the tin
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="shell grid gap-10 sm:grid-cols-3">
          {[
            ['Whole, never milled', 'Flower heads and coarse-cut root. You can see what you are drinking.'],
            ['One ingredient', 'Each single-origin tin lists exactly one plant. No flavouring, colour or filler.'],
            ['Packed in Tamil Nadu', 'Sorted, weighed and sealed in our own unit, in resealable tins.'],
          ].map(([title, body]) => (
            <div key={title} className="border-t border-gold pt-5">
              <h3 className="text-[1.1rem]">{title}</h3>
              <p className="mt-2 text-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
