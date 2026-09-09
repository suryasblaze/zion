import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth, useCart, useSettings } from '../context/StoreProvider'

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
            <img src="/brand/logo-dark.png" alt="" className="h-9 w-auto" />
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
            <Link
              to={user ? '/account' : '/signin'}
              className="hidden sm:inline text-soft hover:text-ink transition-colors"
            >
              {user ? user.full_name?.split(' ')[0] || 'Account' : 'Sign in'}
            </Link>

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
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
