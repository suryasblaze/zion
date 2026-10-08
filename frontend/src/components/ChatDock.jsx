import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { TEAS, FAQS } from '../data/catalog'
import { useCart, useSettings } from '../context/StoreProvider'
import { inr } from '../lib/format'
import Img from './Img'

/**
 * The side dock: a tea guide and a WhatsApp handoff.
 *
 * The guide answers from the same catalogue and FAQ copy the pages use,
 * so it can never contradict the site, and it works with the API down.
 * Anything it cannot answer it hands to WhatsApp rather than guessing --
 * that is where this brand already talks to its customers.
 */

const CHIPS = [
  'Which one helps me sleep?',
  'What is nannari?',
  'Shipping and delivery',
  'How do referrals work?',
  'Is it caffeine free?',
]

const GREETING = {
  from: 'bot',
  text: "Hello. I can help you pick a tea, explain what is in it, or check delivery. What are you after?",
}

/* ------------------------------------------------------------------ */
/* Answering. Keyword scoring over the catalogue, then the FAQ.        */
/* ------------------------------------------------------------------ */
const INTENTS = [
  {
    keys: ['sleep', 'insomnia', 'night', 'bed', 'relax', 'calm', 'stress', 'anxiety', 'unwind'],
    reply: () => ({
      text:
        'For sleep and winding down, chamomile is the one to start with — whole flower heads, brewed 5 minutes at 90°C, about an hour before bed. Lavender does a similar job if the day has been loud. Both are caffeine free.',
      products: ['chamomile', 'lavender'],
    }),
  },
  {
    keys: ['heat', 'cool', 'cooling', 'summer', 'body heat', 'hot weather'],
    reply: () => ({
      text:
        'Nannari is the traditional Tamil body coolant — Indian sarsaparilla root, simmered 8 minutes. Brew it strong, sweeten with jaggery and serve over ice with lime and you have nannari sherbet. Hibiscus is the other good one over ice.',
      products: ['nannari', 'hibiscus'],
    }),
  },
  {
    keys: ['sugar', 'diabetic', 'diabetes', 'blood sugar'],
    reply: () => ({
      text:
        'Aavaram poo is the one traditionally taken for blood sugar balance — it is the flower of Senna auriculata, long used in Siddha practice. To be clear, that is a traditional use and not a medical claim; if you are on medication, ask your doctor first.',
      products: ['aavaram-poo'],
    }),
  },
  {
    keys: ['skin', 'glow', 'complexion', 'acne'],
    reply: () => ({
      text:
        'All six support skin in some way, but aavaram poo and nannari are the two traditionally taken for it. Butterfly pea is the antioxidant-heavy one if you want the collagen angle.',
      products: ['aavaram-poo', 'nannari', 'butterfly-pea'],
    }),
  },
  {
    keys: ['digest', 'bloat', 'stomach', 'gut', 'constipation'],
    reply: () => ({
      text:
        'Chamomile after a meal is the gentlest option. Nannari and aavaram poo both help too, and aavaram poo is the one people take for constipation specifically.',
      products: ['chamomile', 'nannari', 'aavaram-poo'],
    }),
  },
  {
    keys: ['blue', 'colour', 'color', 'purple', 'violet', 'change'],
    reply: () => ({
      text:
        'That is butterfly pea. It brews deep indigo from anthocyanins — the same pigments that colour blueberries — and adding lime shifts it to violet in about five seconds. Real chemistry, no dye.',
      products: ['butterfly-pea'],
    }),
  },
  {
    keys: ['start', 'begin', 'first', 'recommend', 'suggest', 'gift', 'present', 'which one', 'not sure'],
    reply: () => ({
      text:
        'The discovery box is the honest answer — 50 g of all six, roughly ten cups each, so you can try them properly rather than guess. It is also the thing people gift most.',
      products: ['the-six-discovery-box'],
      link: ['See the discovery box', '/product/the-six-discovery-box'],
    }),
  },
  {
    keys: ['refer', 'referral', 'coin', 'wallet', 'invite', 'friend', 'reward', 'points'],
    reply: (cfg) => ({
      text: `Share your referral link and your friend gets a discount on their first order. When they pay, ${cfg.coinName} land in your wallet — ${cfg.rate} coins is ₹1 off your next order. Your link is in your account the moment you register.`,
      link: ['Refer and earn', '/refer'],
    }),
  },
  {
    keys: ['ship', 'deliver', 'courier', 'pincode', 'how long', 'track'],
    reply: () => ({
      text:
        'We ship across India from Tamil Nadu. Free over ₹999, ₹69 below that. Chennai, Coimbatore, Madurai, Tiruchirappalli and Salem usually take 2–3 working days; the rest of India 4–6.',
    }),
  },
  {
    keys: ['caffeine', 'caffiene'],
    reply: () => ({
      text:
        'None of them have any. There is no Camellia sinensis in any tin — nothing that black, green or oolong tea is made from — so you can drink these at eleven at night.',
    }),
  },
  {
    keys: ['brew', 'steep', 'how to make', 'temperature', 'minutes', 'prepare'],
    reply: () => ({
      text:
        'One heaped teaspoon per 200 ml, water matched to the plant, cover the cup. Lavender is the exception: half the leaf, 85°C, and three minutes flat or it turns soapy. Nannari needs a full boil and eight minutes.',
      link: ['Full brewing guide', '/brewing'],
    }),
  },
  {
    keys: ['price', 'cost', 'how much', 'rate'],
    reply: () => ({
      text: `Single-origin tins run ${inr(279)} to ${inr(449)} for 100 g, with 250 g packs at better value. The discovery box is ${inr(1499)} for all six.`,
      link: ['See everything', '/shop'],
    }),
  },
  {
    keys: ['pregnan', 'breastfeed', 'medication', 'safe', 'side effect'],
    reply: () => ({
      text:
        'These are food, not medicine, and we make no medical claims. Hibiscus and senna-family herbs are not usually recommended in pregnancy, and some botanicals interact with medication. Please ask your doctor before making any of them a routine.',
    }),
  },
]

function answer(query, cfg) {
  const q = query.toLowerCase()

  for (const intent of INTENTS) {
    if (intent.keys.some((k) => q.includes(k))) return intent.reply(cfg)
  }

  // Named a tea directly?
  const named = TEAS.find((t) => q.includes(t.name.toLowerCase()) || q.includes(t.slug.replace('-', ' ')))
  if (named) {
    return {
      text: `${named.name} — ${named.short} Brew at ${named.brew.temp}°C for ${named.brew.minutes} minutes. From ${inr(named.price)}.`,
      products: [named.slug],
    }
  }

  // Fall back to the FAQ before giving up.
  const words = q.split(/\W+/).filter((w) => w.length > 3)
  const hit = FAQS.find((f) => words.some((w) => f.q.toLowerCase().includes(w)))
  if (hit) return { text: hit.a }

  return {
    text:
      'I am not sure about that one. A person can answer it properly on WhatsApp — that is where we do most of our talking anyway.',
    whatsapp: true,
  }
}

/* ------------------------------------------------------------------ */
export default function ChatDock() {
  const { get } = useSettings()
  const { open: cartOpen } = useCart()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [mounted, setMounted] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const whatsapp = get('store.whatsapp', '916384013131')
  const cfg = {
    coinName: get('wallet.coin_name', 'ZION Coins'),
    rate: get('wallet.coins_per_rupee', 10),
  }

  // The dock arrives once, a moment after the page settles.
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 900)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, typing, open])

  useEffect(() => {
    if (cartOpen) setOpen(false)
  }, [cartOpen])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 380)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const send = (text) => {
    const q = (text ?? input).trim()
    if (!q) return
    setMessages((m) => [...m, { from: 'you', text: q }])
    setInput('')
    setTyping(true)

    // A beat of delay so a reply reads as a reply, not a lookup.
    setTimeout(() => {
      setTyping(false)
      setMessages((m) => [...m, { from: 'bot', ...answer(q, cfg) }])
    }, 620)
  }

  const waHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    'Hello ZION, I have a question about your herbal teas.'
  )}`

  return (
    <div
      className={`pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col
                  items-end gap-3 transition-opacity duration-200 print:hidden
                  ${cartOpen ? 'pointer-events-none opacity-0' : ''}`}
      aria-hidden={cartOpen}
    >
      {/* ---------------------------------------------------- panel */}
      <section
        aria-label="Tea guide"
        aria-hidden={!open}
        className={`w-[min(360px,calc(100vw-2.5rem))] origin-bottom-right overflow-hidden
                    border border-line bg-paper shadow-[0_20px_60px_rgba(23,19,16,0.16)]
                    transition-all duration-300 ease-ease
                    ${open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                           : 'pointer-events-none translate-y-3 scale-95 opacity-0'}`}
      >
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3.5">
          <Img src="/brand/logo-dark.png" alt="" className="h-8 w-auto" />
          <div className="mr-auto">
            <p className="font-display text-[1.02rem] leading-tight">Tea guide</p>
            <p className="flex items-center gap-1.5 text-micro text-soft">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5C8A4A]" />
              Answers instantly
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-soft transition-colors hover:text-ink"
            aria-label="Close tea guide"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="h-[336px] overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <Message key={i} m={m} waHref={waHref} onClose={() => setOpen(false)} />
          ))}

          {typing && (
            <div className="mb-3 flex gap-1 px-3.5 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-soft/60"
                  style={{
                    animation: 'bounce-dot 1.1s ease-in-out infinite',
                    animationDelay: `${d * 0.16}s`,
                  }}
                />
              ))}
            </div>
          )}

          {messages.length <= 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="border border-line px-3 py-1.5 text-tiny text-soft transition-colors
                             hover:border-gold hover:text-gold"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-center gap-2 border-t border-line px-3 py-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a tea, or delivery…"
            aria-label="Ask a question"
            className="flex-1 bg-transparent px-1.5 py-1.5 text-[0.92rem] placeholder:text-soft/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-ink px-3.5 py-2 text-paper transition-opacity disabled:opacity-25"
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-t border-line bg-surface py-3
                     text-tiny text-soft transition-colors hover:text-ink"
        >
          <WaGlyph className="h-4 w-4 text-[#25763F]" />
          Rather talk to a person? Message us
        </a>
      </section>

      {/* ---------------------------------------------------- buttons */}
      {/* pointer-events-auto on a child re-enables hit testing even inside a
          pointer-events-none parent, so it has to be withdrawn explicitly here
          rather than relying on the container. An invisible button that still
          takes clicks is worse than a visible one. */}
      <div
        className={`flex flex-col items-end gap-2.5 transition-all duration-500 ease-ease
                    ${cartOpen ? 'pointer-events-none' : 'pointer-events-auto'}
                    ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      >
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex h-11 items-center gap-0 overflow-hidden rounded-full border border-line
                     bg-paper pl-3 pr-3 shadow-[0_6px_20px_rgba(23,19,16,0.08)]
                     transition-all duration-300 ease-ease hover:border-[#25763F] hover:pr-4"
          aria-label="Order on WhatsApp"
        >
          <WaGlyph className="h-5 w-5 shrink-0 text-[#25763F]" />
          <span
            className="max-w-0 overflow-hidden whitespace-nowrap text-tiny text-ink
                       transition-all duration-300 ease-ease group-hover:ml-2 group-hover:max-w-[9rem]"
          >
            Order on WhatsApp
          </span>
        </a>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close tea guide' : 'Open tea guide'}
          className="relative grid h-12 w-12 place-items-center rounded-full bg-ink text-paper
                     shadow-[0_8px_24px_rgba(23,19,16,0.22)] transition-transform duration-300
                     ease-ease hover:scale-105"
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full border border-gold-lit"
            style={{ animation: open ? 'none' : 'halo 3.6s ease-out infinite' }}
          />
          {open ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.7L3 21l1.9-5.2A8.2 8.2 0 0 1 4 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8 8.4z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

function Message({ m, waHref, onClose }) {
  const mine = m.from === 'you'
  return (
    <div className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[86%] ${mine ? 'text-right' : ''}`}>
        <p
          className={`px-3.5 py-2.5 text-[0.9rem] leading-relaxed ${
            mine ? 'bg-ink text-paper' : 'border border-line bg-surface text-ink'
          }`}
        >
          {m.text}
        </p>

        {m.products && (
          <div className="mt-2 flex flex-wrap gap-2">
            {m.products.map((slug) => {
              const t = TEAS.find((x) => x.slug === slug)
              return (
                <Link
                  key={slug}
                  to={`/product/${slug}`}
                  onClick={onClose}
                  className="flex items-center gap-2 border border-line bg-paper p-1.5 pr-3
                             transition-colors hover:border-gold"
                >
                  {t && <Img src={t.tile} alt="" className="h-9 w-9 object-cover" />}
                  <span className="text-tiny">
                    {t ? t.name : 'Discovery box'}
                    {t && <span className="nums block text-micro text-soft">{inr(t.price)}</span>}
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {m.link && (
          <Link
            to={m.link[1]}
            onClick={onClose}
            className="mt-2 inline-block border-b border-gold pb-0.5 text-tiny text-gold"
          >
            {m.link[0]}
          </Link>
        )}

        {m.whatsapp && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 border border-[#25763F]/40 px-3 py-2
                       text-tiny text-[#25763F] transition-colors hover:bg-[#25763F]/5"
          >
            <WaGlyph className="h-4 w-4" />
            Ask on WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}

function WaGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.92 6.45 17.5 2 12.04 2zm0 18.15h-.01c-1.49 0-2.95-.4-4.22-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23z" />
    </svg>
  )
}
