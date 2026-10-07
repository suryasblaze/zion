import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo'
import { api } from '../lib/api'
import { useAuth, useSettings } from '../context/StoreProvider'

/**
 * One component, two modes. Sign-in and registration share the panel, the
 * validation and the error surface; only the fields differ.
 *
 * When someone arrives on a referral link the code is already in local
 * storage, so we look up who invited them and say so by name — that is
 * the whole reason the referral converts.
 */
export default function Auth({ mode = 'signin' }) {
  const isSignup = mode === 'signup'
  const { login, register, user } = useAuth()
  const { get } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [invite, setInvite] = useState(null)

  const next = new URLSearchParams(location.search).get('next') || '/account'
  const coinName = get('wallet.coin_name', 'ZION Coins')

  useEffect(() => {
    if (user) navigate(next, { replace: true })
  }, [user, navigate, next])

  // Who invited them, if anyone.
  useEffect(() => {
    const code = localStorage.getItem('zion.ref')
    if (!code || !isSignup) return
    api.referralPreview(code).then(setInvite).catch(() => setInvite(null))
  }, [isSignup])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
    setNotice(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setNotice(null)
    try {
      if (isSignup) {
        const res = await register(form)
        const welcome = res?.referral?.welcome_points
        navigate(next, {
          replace: true,
          state: welcome ? { welcome } : undefined,
        })
      } else {
        await login(form.email, form.password)
        navigate(next, { replace: true })
      }
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
        title={isSignup ? 'Create your ZION account' : 'Sign in — ZION Herbs'}
        description="Sign in to track orders, spend your coins and share your referral link."
        noindex
      />

      <section className="shell grid gap-16 py-16 lg:grid-cols-[1fr_.9fr]">
        {/* ------------------------------------------------ the form */}
        <div className="mx-auto w-full max-w-[440px] lg:mx-0">
          <p className="script mb-1">{isSignup ? 'Join us' : 'Welcome back'}</p>
          <h1 className="text-d2">{isSignup ? 'Create your account' : 'Sign in'}</h1>

          {invite && invite.enabled && (
            <div className="mt-6 border-l-2 border-gold bg-surface px-5 py-4">
              <p className="text-[0.95rem]">
                <span className="text-gold">{invite.referrer_name}</span> invited you.
              </p>
              <p className="mt-1 text-tiny text-soft">
                {invite.discount_label
                  ? `Your first order gets ${invite.discount_label}, on orders over ₹${Number(
                      invite.min_order
                    ).toLocaleString('en-IN')}.`
                  : 'Your discount is applied at checkout.'}
              </p>
            </div>
          )}

          {notice && (
            <p
              role="alert"
              className="mt-6 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.06] px-4 py-3 text-[0.92rem] text-[#8F3623]"
            >
              {notice}
            </p>
          )}

          <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
            {isSignup && (
              <Field
                id="full_name"
                label="Your name"
                value={form.full_name}
                onChange={set('full_name')}
                error={errors.full_name}
                autoComplete="name"
                required
              />
            )}

            <Field
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              autoComplete="email"
              required
            />

            {isSignup && (
              <Field
                id="phone"
                label="Phone"
                hint="For delivery updates"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                error={errors.phone}
                autoComplete="tel"
              />
            )}

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className={`field pr-16 ${errors.password ? 'border-[#B4472F]' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tiny text-soft hover:text-ink"
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1.5 text-tiny text-[#8F3623]">{errors.password}</p>
              ) : isSignup ? (
                <p className="mt-1.5 text-tiny text-soft">
                  At least 8 characters, with a number.
                </p>
              ) : null}
            </div>

            <button disabled={busy} className="btn btn-solid mt-1 w-full disabled:opacity-50">
              {busy
                ? isSignup
                  ? 'Creating your account…'
                  : 'Signing in…'
                : isSignup
                ? 'Create account'
                : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-[0.95rem] text-soft">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <Link
              to={isSignup ? '/signin' : '/signup'}
              className="border-b border-gold pb-0.5 text-gold"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>

        {/* ------------------------------------------------ the reason */}
        <aside className="border-l-0 lg:border-l lg:border-line lg:pl-16">
          <h2 className="text-d3">What an account gets you</h2>
          <ul className="mt-6 grid gap-5">
            {[
              ['Your referral link', `Ready the moment you register. Share it and earn ${coinName}.`],
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

          <figure className="mt-10 m-0">
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

function Field({ id, label, hint, error, ...props }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className={`field ${error ? 'border-[#B4472F]' : ''}`} {...props} />
      {error ? (
        <p className="mt-1.5 text-tiny text-[#8F3623]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-tiny text-soft">{hint}</p>
      ) : null}
    </div>
  )
}
