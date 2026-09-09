import { useState } from 'react'
import Seo, { faqSchema } from '../components/Seo'
import { FAQS } from '../data/catalog'

export default function Faq() {
  const [query, setQuery] = useState('')
  const shown = FAQS.filter(
    (f) =>
      !query ||
      f.q.toLowerCase().includes(query.toLowerCase()) ||
      f.a.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <Seo
        title="Questions about ZION herbal teas"
        description="Caffeine, brewing times, what nannari and aavaram poo are, shipping across India, and how the referral programme works."
        canonical="https://zionherbs.in/faq"
        schema={faqSchema(FAQS)}
      />

      <header className="border-b border-line">
        <div className="shell py-16">
          <p className="script mb-1">Straight answers</p>
          <h1 className="max-w-[20ch] text-d1">Questions we actually get</h1>
          <div className="mt-8 max-w-[42ch]">
            <label className="label" htmlFor="q">Search</label>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="caffeine, nannari, shipping…"
              className="field"
            />
          </div>
        </div>
      </header>

      <section className="py-16">
        <div className="shell max-w-[840px]">
          {shown.length === 0 ? (
            <div className="border border-line py-16 text-center">
              <p className="script mb-2">Nothing matches that</p>
              <p className="text-soft">
                Try a shorter word — or message us on WhatsApp at +91 63840 13131 and a person will
                answer.
              </p>
            </div>
          ) : (
            shown.map((f) => (
              <details key={f.q} className="group border-b border-line py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                  <h2 className="text-[1.15rem]">{f.q}</h2>
                  <span className="mt-1 shrink-0 text-gold transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[68ch] text-soft">{f.a}</p>
              </details>
            ))
          )}
        </div>
      </section>
    </>
  )
}
