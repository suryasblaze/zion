import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/StoreProvider'
import Img from './Img'

const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      ['All teas', '/shop'],
      ['Discovery box', '/product/the-six-discovery-box'],
      ['Calm trio', '/product/the-calm-trio'],
      ['Gift sets', '/shop?category=gift-sets'],
    ],
  },
  {
    heading: 'Learn',
    links: [
      ['Brewing guide', '/brewing'],
      ['The six herbs', '/the-six'],
      ['Our roots', '/our-roots'],
      ['Questions', '/faq'],
    ],
  },
  {
    heading: 'Account',
    links: [
      ['Sign in', '/signin'],
      ['My orders', '/account'],
      ['Refer & earn', '/refer'],
      ['Track an order', '/account'],
    ],
  },
]

export default function Footer() {
  const { get } = useSettings()
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle')

  const whatsapp = get('store.whatsapp', '916384013131')
  const phone = get('store.phone', '+91 63840 13131')

  const subscribe = (e) => {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return setState('invalid')
    setState('done')
  }

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="shell py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <Img src="/brand/logo-dark.png" alt="" className="h-11 w-auto" />
              <span className="font-display text-[1.35rem] tracking-[0.22em]">ZION</span>
            </div>
            <p className="mt-4 max-w-[32ch] text-soft">
              Caffeine-free herbal infusions, hand-packed in Tamil Nadu. Six botanicals, nothing
              added.
            </p>

            <form onSubmit={subscribe} className="mt-7 max-w-[34ch]">
              <label className="label" htmlFor="news">
                Brewing notes, once a month
              </label>
              <div className="flex gap-2">
                <input
                  id="news"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setState('idle')
                  }}
                  placeholder="you@example.com"
                  className="field"
                />
                <button className="btn btn-gold shrink-0 px-5">Join</button>
              </div>
              {state === 'invalid' && (
                <p className="mt-2 text-tiny text-[#B4472F]">
                  That address does not look right. Check the spelling.
                </p>
              )}
              {state === 'done' && (
                <p className="mt-2 text-tiny text-gold">You are on the list. First note next month.</p>
              )}
            </form>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h5 className="mb-4 font-body text-micro uppercase tracking-[0.15em] text-gold">
                {col.heading}
              </h5>
              <ul className="grid gap-2.5">
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-soft transition-colors hover:text-ink">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-5 border-t border-line pt-7">
          <div className="flex flex-wrap items-center gap-5 text-tiny text-soft">
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-ink">
              {phone}
            </a>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink"
            >
              Order on WhatsApp
            </a>
            <span>Chennai, Tamil Nadu</span>
          </div>

          <p className="script text-[1.9rem]">Sip nature, sip wellness</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-4 text-tiny text-soft">
          <span>© {new Date().getFullYear()} ZION Herbs. All rights reserved.</span>
          <span className="flex gap-4">
            <Link to="/p/shipping-policy" className="hover:text-ink">Shipping</Link>
            <Link to="/p/returns-policy" className="hover:text-ink">Returns</Link>
            <Link to="/p/privacy-policy" className="hover:text-ink">Privacy</Link>
            <Link to="/p/terms" className="hover:text-ink">Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
