import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo'
import { useAuth, useSettings } from '../context/StoreProvider'

/**
 * Sign in.
 *
 * There is no public registration. Accounts are created by an admin under
 * Customers, so this page does one thing and says where to get an account
 * rather than pretending there is a form for it.
 */
export default function Auth() {
  const { login, user } = useAuth()
  const { get } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  const next = new URLSearchParams(location.search).get('next') || '/account'
  const coinName = get('wallet.coin_name', 'ZION Coins')
  const whatsapp = get('store.whatsapp', '916384013131')
  const storeEmail = get('store.email', 'hello@zionherbs.com')

  useEffect(() => {
    if (user) navigate(next, { replace: true })
  }, [user, navigate, next])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
    setNotice(null)
  }

  const submit = async (e) => {
    e.preventDefault()

    const found = {}
    if (!form.email.trim()) found.email = 'Enter your email.'
    if (!form.password) found.password = 'Enter your password.'
    if (Object.keys(found).length) {
      setErrors(found)
      document.getElementById(Object.keys(found)[0])?.focus()
      return
    }

    setBusy(true)
    setErrors({})
    setNotice(null)
    try {
      await login(form.email, form.password)
      navigate(next, { replace: true })
    } catch (err) {
      setErrors(err.payload?.errors || {})
      setNotice(err.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Seo
        title="Sign in — ZION Herbs"
        description="Sign in to track orders, spend your coins and share your referral link."
        noindex
      />

      <section className="shell grid gap-16 py-16 lg:grid-cols-[1fr_.9fr]">
        {/* ------------------------------------------------ the form */}
        <div className="mx-auto w-full max-w-[440px] lg:mx-0">
          <p className="script mb-1">Welcome back</p>
          <h1 className="text-d2">Sign in</h1>

          {notice && (
            <p
              role="alert"
              className="mt-6 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.06] px-4 py-3 text-[0.92rem] text-[#8F3623]"
            >
              {notice}
            </p>
          )}

          <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                autoFocus
                className={`field py-3.5 ${errors.email ? 'border-[#B4472F]' : ''}`}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="mt-1.5 text-tiny text-[#8F3623]">{errors.email}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="current-password"
                  className={`field py-3.5 pr-16 ${errors.password ? 'border-[#B4472F]' : ''}`}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tiny text-soft hover:text-ink"
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-tiny text-[#8F3623]">{errors.password}</p>
              )}
            </div>

            {/* The only action on the page, so it carries the weight of
                one: full width, gold, lifting slightly, and saying what it
                is doing while it does it. */}
            <button
              disabled={busy}
              className="group mt-2 flex w-full items-center justify-center gap-3 rounded
                         bg-gold px-7 py-4 text-[1.02rem] tracking-[0.04em] text-paper
                         shadow-[0_6px_20px_rgba(143,114,34,0.22)]
                         transition-all duration-300 ease-ease
                         hover:-translate-y-px hover:brightness-110
                         hover:shadow-[0_10px_28px_rgba(143,114,34,0.30)]
                         disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <span
                    className="h-4 w-4 rounded-full border-2 border-paper/40 border-t-paper"
                    style={{ animation: 'spin 0.7s linear infinite' }}
                    aria-hidden="true"
                  />
                  Signing you in…
                </>
              ) : (
                <>
                  Sign in
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-[0.95rem]">No account yet?</p>
            <p className="mt-1 max-w-[44ch] text-tiny text-soft">
              We set accounts up by hand, so there is nothing to fill in here. Message us and we
              will have you signed in the same day.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-tiny">
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-gold pb-0.5 text-gold"
              >
                Ask on WhatsApp
              </a>
              <a
                href={`mailto:${storeEmail}`}
                className="border-b border-line pb-0.5 text-soft hover:text-ink"
              >
                {storeEmail}
              </a>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ the reason */}
        <aside className="lg:border-l lg:border-line lg:pl-16">
          <h2 className="text-d3">What signing in gets you</h2>
          <ul className="mt-6 grid gap-5">
            {[
              ['Your referral link', `Share it and earn ${coinName} when a friend orders.`],
              [`${coinName} wallet`, 'Coins come off your next order at checkout — no codes to remember.'],
              ['Order tracking', 'Every order, its status and its tracking number in one place.'],
              ['Faster checkout', 'Saved addresses, so reordering takes a few seconds.'],
            ].map(([title, body]) => (
              <li key={title} className="border-t border-line pt-4">
                <h3 className="text-[1.05rem]">{title}</h3>
                <p className="mt-1 max-w-[40ch] text-soft">{body}</p>
              </li>
            ))}
          </ul>

          <figure className="m-0 mt-10">
            <img
              src="/products/set-six-tile.jpg"
              alt="The six ZION herbal infusions"
              className="border border-line"
              loading="lazy"
            />
          </figure>
        </aside>
      </section>
    </>
  )
}
