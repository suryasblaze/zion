import { useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/StoreProvider'

/**
 * Admin chrome.
 *
 * Deliberately not the storefront: a dark ink rail against a working
 * canvas, dense rows, hairline rules, and no card shadows. The rail keeps
 * the brand; the canvas is built for reading tables, not for browsing.
 */

const NAV = [
  {
    group: 'Shop',
    items: [
      ['Overview', '/admin', 'grid'],
      ['Orders', '/admin/orders', 'box'],
      ['Products', '/admin/products', 'leaf'],
      ['Customers', '/admin/customers', 'user'],
    ],
  },
  {
    group: 'Growth',
    items: [
      ['Referrals', '/admin/referrals', 'share'],
      ['Event sign-ups', '/admin/signups', 'ticket'],
      ['Coupons', '/admin/coupons', 'tag'],
    ],
  },
  {
    group: 'Site',
    items: [
      ['Content', '/admin/content', 'text'],
      ['Design studio', '/admin/design', 'brush'],
      ['Settings', '/admin/settings', 'sliders'],
    ],
  },
]

export default function AdminShell() {
  const { user, ready } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  if (!ready)
    return <div className="grid min-h-screen place-items-center text-soft">Loading…</div>

  // The staff door, not the shop's. Someone opening /admin wants the
  // panel; sending them to the customer sign-in made the panel look
  // like somewhere they had arrived by mistake.
  if (!user)
    return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname)}`} replace />

  // A shopper who followed a link here. /admin/login says the same thing
  // and offers the way out, so there is one place that explains it.
  if (!['admin', 'staff'].includes(user.role))
    return <Navigate to="/admin/login" replace />


  return (
    <div className="min-h-screen bg-[rgb(250_249_246)] lg:grid lg:grid-cols-[248px_1fr]">
      {/* -------------------------------------------------- the rail */}
      <aside
        className={`z-50 flex flex-col bg-[#171310] text-[rgb(226_220_209)] lg:sticky lg:top-0 lg:h-screen
                    ${open ? 'fixed inset-0' : 'hidden lg:flex'}`}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <img src="/brand/logo-light.png" alt="" className="h-8 w-auto" />
          <div className="mr-auto">
            <p className="font-display text-[1.05rem] tracking-[0.2em] text-white">ZION</p>
            <p className="text-micro uppercase tracking-[0.14em] text-white/40">Admin</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/50 lg:hidden" aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {NAV.map((section) => (
            <div key={section.group} className="mb-6">
              <p className="px-3 pb-2 text-micro uppercase tracking-[0.16em] text-white/35">
                {section.group}
              </p>
              {section.items.map(([label, to, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/admin'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded px-3 py-2.5 text-[0.92rem] transition-colors ${
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                    }`
                  }
                >
                  <Icon name={icon} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-tiny text-white/70">{user.full_name || user.email}</p>
          <p className="text-micro uppercase tracking-wide text-white/35">{user.role}</p>
          <NavLink to="/" className="mt-2 inline-block text-tiny text-[#C8A44D] hover:underline">
            View the shop →
          </NavLink>
        </div>
      </aside>

      {/* ------------------------------------------------ the canvas */}
      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-[rgb(250_249_246)]/95 px-5 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </button>
          <span className="font-display tracking-[0.2em]">ZION Admin</span>
        </div>

        <Outlet />
      </div>
    </div>
  )
}

/* Small line icons, drawn rather than pulled from a pack, so the rail
   stays one stroke weight throughout. */
function Icon({ name }) {
  const paths = {
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
    leaf: 'M4 20c0-8 6-14 16-15 0 10-5 16-13 16-1.5 0-3-.3-3-1zM8 17c2-4 5-6 8-7',
    user: 'M4 20c0-4 3.5-6 8-6s8 2 8 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    share: 'M6 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM23 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM23 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM6 11l12-5M6 13l12 5',
    tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
    ticket: 'M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4zM14 6v12',
    text: 'M4 6h16M4 11h16M4 16h9',
    brush: 'M4 20c3 1 6-1 6-4 0-1.5-1-2.5-2.5-2.5S5 14.5 5 16c0 2-.5 3-1 4zM11 14L20 5l-2-2-9 9',
    sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
      <path d={paths[name] || paths.grid} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Shared admin primitives                                             */
/* ------------------------------------------------------------------ */
export function PageHead({ title, sub, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 py-6 lg:px-9 lg:py-8">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-[60ch] text-soft">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}

export function Toast({ tone = 'ok', children, onDone }) {
  if (!children) return null
  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 border px-5 py-3 text-[0.92rem]
                  shadow-[0_10px_36px_rgba(23,19,16,0.16)] ${
                    tone === 'error'
                      ? 'border-[#B4472F] bg-[#FDF4F2] text-[#8F3623]'
                      : 'border-line bg-paper text-ink'
                  }`}
      onAnimationEnd={onDone}
    >
      {children}
    </div>
  )
}

export function Empty({ title, body, children }) {
  return (
    <div className="border border-line bg-paper py-16 text-center">
      <p className="font-display text-[1.2rem]">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-soft">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

export function Pill({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'border-line text-soft',
    gold: 'border-gold text-gold',
    good: 'border-[#5C8A4A] text-[#4A7239]',
    bad: 'border-[#B4472F] text-[#8F3623]',
  }
  return (
    <span className={`inline-block whitespace-nowrap border px-2.5 py-0.5 text-micro uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  )
}
