import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth, useCart, useSettings } from '../context/StoreProvider'
import Img from './Img'

const LINKS = [
  { to: '/shop', label: 'Shop' },
  { to: '/the-six', label: 'The six' },
  { to: '/our-roots', label: 'Our roots' },
  { to: '/brewing', label: 'Brewing' },
  { to: '/refer', label: 'Refer & earn' },
]

export default function Header() {
  const { get } = useSettings()
  const { count, setOpen } = useCart()
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const announcement = get('store.announcement', '')

  return (
    <>
      {announcement && (
        <div className="bg-ink text-paper text-center text-tiny tracking-[0.06em] py-2.5 px-4">
          {announcement}
        </div>
      )}

      <header
        className={`sticky top-0 z-40 bg-paper/90 backdrop-blur-md transition-shadow duration-300 ${
          scrolled ? 'border-b border-line' : 'border-b border-transparent'
        }`}
      >
        <div className="shell flex h-[74px] items-center gap-9">
          <Link to="/" className="mr-auto flex items-center gap-2.5" aria-label="ZION Herbs, home">
            <Img src="/brand/logo-dark.png" alt="" className="h-9 w-auto" />
            <span className="font-display text-[1.25rem] tracking-[0.22em]">ZION</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-[0.9rem]">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `relative py-1 transition-colors duration-200 ${
                    isActive ? 'text-gold' : 'text-soft hover:text-ink'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4 text-[0.9rem]">
            {/* Signed out this is a filled gold button: it was grey text
                beside an outlined Bag, which read as a label rather than
                something to press. Signed in it steps back to an outline
                with the initial, because the shop, not the account, is
                what someone is here for. */}
            {/* Staff have no other way in. Without this the panel is a
                URL you have to remember and type. */}
            {(user?.role === 'admin' || user?.role === 'staff') && (
              <Link
                to="/admin"
                className="hidden items-center gap-1.5 text-soft transition-colors hover:text-gold sm:inline-flex"
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.6" aria-hidden="true"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                Admin
              </Link>
            )}

            {user ? (
              <Link
                to="/account"
                className="hidden items-center gap-2 rounded border border-line py-1.5 pl-1.5 pr-3.5
                           transition-colors hover:border-gold hover:text-gold sm:inline-flex"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-[0.72rem] text-paper">
                  {(user.full_name || 'A').trim().charAt(0).toUpperCase()}
                </span>
                {user.full_name?.split(' ')[0] || 'Account'}
              </Link>
            ) : (
              <Link
                to="/signin"
                className="group hidden items-center gap-2 rounded bg-gold px-5 py-2.5 text-paper
                           shadow-[0_1px_0_rgba(0,0,0,0.06)] transition-all duration-300
                           hover:brightness-110 hover:shadow-[0_3px_14px_rgba(200,164,77,0.45)]
                           sm:inline-flex"
              >
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.7" aria-hidden="true"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Sign in
              </Link>
            )}

            <button
              onClick={() => setOpen(true)}
              className="rounded border border-line px-4 py-2 transition-colors hover:border-gold hover:text-gold"
            >
              Bag <span className="nums">· {count}</span>
            </button>

            <button
              className="lg:hidden text-soft"
              aria-label="Open menu"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
              </svg>
            </button>
          </div>
        </div>

        {menu && (
          <nav className="lg:hidden border-t border-line bg-paper">
            <div className="shell flex flex-col py-2">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenu(false)}
                  className="border-b border-line py-3.5 text-soft last:border-0"
                >
                  {l.label}
                </NavLink>
              ))}

              {/* The desktop button is hidden below sm, so without this
                  there is no way to sign in from a phone at all. */}
              <Link
                to={user ? '/account' : '/signin'}
                onClick={() => setMenu(false)}
                className="mt-3 flex items-center justify-center gap-2 rounded bg-gold px-5 py-3 text-paper"
              >
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.7" aria-hidden="true"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {user ? user.full_name?.split(' ')[0] || 'My account' : 'Sign in'}
              </Link>
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
