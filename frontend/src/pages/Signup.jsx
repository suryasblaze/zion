import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo'
import Img from '../components/Img'
import { useAuth, useSettings } from '../context/StoreProvider'

/**
 * Create an account.
 *
 * Gated server-side by the auth.public_signup setting, so this page can
 * exist while registration is closed. When it is closed the API refuses
 * with signup_closed and the page says so plainly instead of leaving a
 * form up that cannot work.
 *
 * The referral code is read from localStorage, not from a field: it was
 * put there by /r/CODE when the friend's link was opened, possibly days
 * ago. Asking someone to retype a code they never saw loses the
 * attribution, and the attribution is the whole programme.
 */

/* Field name -> message when it is empty. Kept as data so the submit
   handler stays a loop rather than a stack of ifs. */
const REQUIRED = [
  ['full_name', 'Tell us your name.'],
  ['email', 'Enter your email.'],
  ['password', 'Choose something at least 8 characters long.'],
]

export default function Signup() {
  const { register, user } = useAuth()
  const { get } = useSettings()
  const navigate = useNavigate()

  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  const coinName = get('wallet.coin_name', 'ZION Coins')
  const whatsapp = get('store.whatsapp', '916384013131')
  const referredBy = typeof localStorage !== 'undefined' ? localStorage.getItem('zion.ref') : null

  useEffect(() => {
    if (user) navigate('/account', { replace: true })
  }, [user, navigate])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
    setNotice(null)
  }

  const submit = async (e) => {
    e.preventDefault()

    const found = {}
    for (const [key, message] of REQUIRED) {
      if (!String(form[key] || '').trim()) found[key] = message
    }
    if (Object.keys(found).length) {
      setErrors(found)
      document.getElementById(Object.keys(found)[0])?.focus()
      return
    }

    setBusy(true)
    setErrors({})
    setNotice(null)
    try {
      await register(form)
      navigate('/account', { replace: true })
    } catch (err) {
      // Registration being shut is not a form error -- no amount of
      // retyping fixes it, so the form goes away and the page explains.
      if (err.payload?.code === 'signup_closed') {
        setClosed(true)
        setNotice(err.message)
      } else {
        setErrors(err.payload?.errors || {})
        setNotice(err.message || 'Something went wrong. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Seo
        title="Create your account — ZION Herbs"
        description="Create a ZION account to track orders, collect coins and share your referral link."
        canonical="https://zionherbs.com/signup"
      />

      <section className="shell grid gap-16 py-16 lg:grid-cols-[1fr_.9fr]">
        <div className="mx-auto w-full max-w-[440px] lg:mx-0">
          <p className="script mb-1">Join us</p>
          <h1 className="text-d2">Create your account</h1>

          {referredBy && !closed && (
            <p className="mt-5 border-l-2 border-gold bg-gold/[0.06] px-4 py-3 text-[0.93rem]">
              You were invited by a friend — your first-order discount is saved and applies at
              checkout.
            </p>
          )}

          {notice && (
            <p
              role="alert"
              className="mt-6 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.06] px-4 py-3 text-[0.92rem] text-[#8F3623]"
            >
              {notice}
            </p>
          )}

          {closed ? (
            <div className="mt-7 border border-line bg-surface p-7">
              <p className="text-soft">
                We are setting accounts up by hand at the moment. Message us and we will have
                yours ready the same day — or carry on and order as a guest, which needs no
                account at all.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Hello ZION, I would like an account.')}`}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-gold"
                >
                  Ask on WhatsApp
                </a>
                <Link to="/shop" className="btn btn-ghost">Browse the teas</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
              <Field id="full_name" label="Your name" value={form.full_name}
                     onChange={set('full_name')} err={errors.full_name} autoFocus
                     autoComplete="name" />

              <Field id="email" label="Email" type="email" value={form.email}
                     onChange={set('email')} err={errors.email} autoComplete="email"
                     hint="Order receipts and your reset link go here." />

              <Field id="phone" label="Mobile number" type="tel" value={form.phone}
                     onChange={set('phone')} err={errors.phone} autoComplete="tel"
                     hint="Optional. Used only for delivery updates." />

              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    className={`field py-3.5 pr-16 ${errors.password ? 'border-[#B4472F]' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-tiny text-soft hover:text-ink"
                  >
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-1.5 text-tiny text-[#8F3623]">{errors.password}</p>
                ) : (
                  <p className="mt-1.5 text-tiny text-soft">
                    At least 8 characters, including a number.
                  </p>
                )}
              </div>

              <button type="submit" disabled={busy} className="btn btn-gold w-full disabled:opacity-60">
                {busy ? (
                  <>
                    <span
                      className="h-4 w-4 rounded-full border-2 border-paper/30 border-t-paper"
                      style={{ animation: 'spin 0.7s linear infinite' }}
                    />
                    Creating…
                  </>
                ) : (
                  <>
                    Create account
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 border-t border-line pt-5 text-tiny text-soft">
            <p>
              Already have an account?{' '}
              <Link to="/signin" className="text-gold underline underline-offset-4">Sign in</Link>
            </p>
            <p className="mt-2">
              You do not need an account to order — guest checkout works for everyone.
            </p>
          </div>
        </div>

        <aside className="lg:border-l lg:border-line lg:pl-16">
          <h2 className="text-d3">What an account gets you</h2>
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
            <Img
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

function Field({ id, label, err, hint, ...rest }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        {...rest}
        aria-invalid={!!err}
        className={`field py-3.5 ${err ? 'border-[#B4472F]' : ''}`}
      />
      {err ? (
        <p className="mt-1.5 text-tiny text-[#8F3623]">{err}</p>
      ) : hint ? (
        <p className="mt-1.5 text-tiny text-soft">{hint}</p>
      ) : null}
    </div>
  )
}
