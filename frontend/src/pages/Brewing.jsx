import Seo from '../components/Seo'
import { canonical } from '../lib/site'
import { TEAS } from '../data/catalog'
import { accentStyle } from '../lib/format'

const STEPS = [
  ['Measure', 'One heaped teaspoon per 200 ml cup. Lavender is the exception — use half.'],
  ['Heat', 'Match the water to the plant. Flowers scorch above 90°C; root needs a full boil.'],
  ['Cover', 'A saucer over the cup keeps the aromatics in. This matters more than the leaf.'],
  ['Strain', 'On time. Every one of these turns bitter if you forget it and walk away.'],
]

export default function Brewing() {
  return (
    <>
      <Seo
        title="How to brew each ZION herbal tea — temperature and steeping time"
        description="Water temperature and steeping time for butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo, plus iced brewing notes."
        canonical={canonical('/brewing')}
      />

      <header className="border-b border-line">
        <div className="shell py-16">
          <p className="script mb-1">Get it right the first time</p>
          <h1 className="max-w-[22ch] text-d1">Six plants, six brewing times</h1>
          <p className="mt-5 max-w-[56ch] text-lede text-soft">
            Herbal tea is forgiving until it isn't. Lavender turns soapy after three minutes;
            nannari root gives you nothing under eight. This is the card that ships in every box.
          </p>
        </div>
      </header>

      <section className="py-16">
        <div className="shell">
          <h2 className="mb-8 text-d2">The method, whichever tin you open</h2>
          <ol className="grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title}>
                <span className="nums font-display text-[1.1rem] text-gold">0{i + 1}</span>
                <h3 className="mt-2 text-[1.08rem]">{title}</h3>
                <p className="mt-1.5 text-soft">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line py-16">
        <div className="shell">
          <h2 className="mb-8 text-d2">Per tea</h2>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[620px] text-left">
              <thead className="border-b border-line bg-surface text-tiny uppercase tracking-wide text-soft">
                <tr>
                  <th className="px-5 py-3.5 font-normal">Tea</th>
                  <th className="px-5 py-3.5 font-normal">Water</th>
                  <th className="px-5 py-3.5 font-normal">Steep</th>
                  <th className="px-5 py-3.5 font-normal">Cup</th>
                  <th className="px-5 py-3.5 font-normal">Note</th>
                </tr>
              </thead>
              <tbody className="nums">
                {TEAS.map((t) => (
                  <tr key={t.slug} style={accentStyle(t)} className="border-b border-line last:border-0">
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-3">
                        <span className="h-7 w-[3px] bg-accent" />
                        <span>
                          <span className="block">{t.name}</span>
                          <span className="block text-tiny italic text-soft">{t.botanical}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-4">{t.brew.temp}°C</td>
                    <td className="px-5 py-4">{t.brew.minutes} min</td>
                    <td className="px-5 py-4 text-soft">{t.cup}</td>
                    <td className="px-5 py-4 text-soft">{BREW_NOTE[t.slug]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 max-w-[68ch] text-tiny text-soft">
            All six are caffeine free, so a second cup at night costs you nothing. Store the tins
            sealed, cool and dark — not in the fridge, where condensation is what actually spoils
            dried botanicals.
          </p>
        </div>
      </section>
    </>
  )
}

const BREW_NOTE = {
  'butterfly-pea': 'Add lime and it turns violet',
  hibiscus: 'Best of the six over ice',
  chamomile: 'Cover the cup, or the aroma leaves',
  lavender: 'Half the leaf, half the time',
  nannari: 'Simmer, do not steep. Jaggery suits it',
  'aavaram-poo': 'Should be clear gold, never cloudy',
}
