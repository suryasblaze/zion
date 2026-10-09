import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/StoreProvider'
import Img from '../components/Img'

/**
 * Staff sign-in, at /admin/login.
 *
 * Deliberately not the shop's /signin. Same accounts and same endpoint --
 * one user table, and the role decides access, which is where the real
 * check lives -- but a customer checking an order and a manager opening
 * the panel are different errands, and one page serving both made the
 * panel feel like somewhere you had arrived by mistake.
 *
 * Built on the shop's own paper and gold rather than the panel's dark
 * rail: this is the first thing anyone sees in the morning, and it
 * should look like the brand, not like a terminal.
 *
 * Not a security boundary, and it does not pretend to be one. Every
 * /api/admin/* route checks the role itself; this page is about not
 * making people guess which door is theirs.
 */

/** Own title, and kept out of search results -- robots.txt stops
 *  crawling but not the indexing of a URL something has linked to. */
function useAdminDoorMeta() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Staff sign in — ZION'

    let tag = document.head.querySelector('meta[name="robots"]')
    const existed = !!tag
    const before = tag?.getAttribute('content')
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('name', 'robots')
      document.head.appendChild(tag)
    }
    tag.setAttribute('content', 'noindex,nofollow')

    return () => {
      document.title = previous
      if (existed) tag.setAttribute('content', before ?? 'index,follow')
      else tag.remove()
    }
  }, [])
}

export default function AdminLogin() {
  const { user, ready, login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  useAdminDoorMeta()

  const next = new URLSearchParams(location.search).get('next') || '/admin'
  const isStaff = (u) => !!u && (u.role === 'admin' || u.role === 'staff')

  if (!ready) return <Frame><p className="text-soft">Loading…</p></Frame>

  // Already signed in with the rights: straight through, rather than a
  // form shown to someone who does not need it.
  if (isStaff(user)) return <Navigate to={next} replace />

  // Signed in, but as a shopper. Saying so beats a failed login they
  // cannot explain, and the way out is to sign out, not to try again.
  if (user)
    return (
      <Frame>
        <div className="text-center">
          <Mark />
          <h1 className="mt-8 text-d3">This account cannot open the panel</h1>
          <p className="mx-auto mt-3 max-w-[38ch] text-soft">
            You are signed in as {user.email}. Sign out and use the account ZION set up for you.
          </p>
          <button onClick={logout} className="btn btn-gold mt-7 w-full">
            Sign out
          </button>
          <Link
            to="/"
            className="mt-4 block text-tiny text-soft underline underline-offset-4 hover:text-ink"
          >
            Back to the shop
          </Link>
        </div>
      </Frame>
    )

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((p) => ({ ...p, [key]: undefined }))
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
      const signedIn = await login(form.email, form.password)
      // The credentials were right, so this is not a sign-in failure --
      // it is the wrong account. Say that, rather than leaving someone
      // retyping a password that was never the problem.
      if (!isStaff(signedIn)) {
        setNotice('That is a customer account. It cannot open the panel.')
        return
      }
      navigate(next, { replace: true })
    } catch (err) {
      setErrors(err.payload?.errors || {})
      setNotice(err.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame>
      <Mark />

      <p className="script mt-7">Good morning</p>
      <h1 className="mt-1 text-d2">Staff sign in</h1>
      <p className="mt-3 text-soft">
        Orders, stock, content and sign-ups — all behind this one door.
      </p>

      {notice && (
        <p
          role="alert"
          className="mt-6 border-l-2 border-[#B4472F] bg-[#FDF4F2] px-4 py-3 text-[0.92rem] text-[#8F3623]"
        >
          {notice}
        </p>
      )}

      <form onSubmit={submit} noValidate className="mt-7 grid gap-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            value={form.email}
            onChange={set('email')}
            aria-invalid={!!errors.email}
            className={`field py-3.5 ${errors.email ? 'border-[#B4472F]' : ''}`}
          />
          {errors.email && <p className="mt-1.5 text-tiny text-[#8F3623]">{errors.email}</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
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
          {errors.password && <p className="mt-1.5 text-tiny text-[#8F3623]">{errors.password}</p>}
        </div>

        <button type="submit" disabled={busy} className="btn btn-gold mt-2 w-full disabled:opacity-60">
          {busy ? (
            <>
              <span
                className="h-4 w-4 rounded-full border-2 border-paper/30 border-t-paper"
                style={{ animation: 'spin 0.7s linear infinite' }}
              />
              Checking…
            </>
          ) : (
            <>
              Open the panel
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </>
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-line pt-5 text-tiny text-soft">
        Staff only. Shopping?{' '}
        <Link to="/signin" className="text-gold underline underline-offset-4">
          Customer sign-in
        </Link>
      </p>
    </Frame>
  )
}

/**
 * The real lockup, at a size that carries a page rather than a nav bar.
 *
 * No "ZION" set beside it: this asset is a vertical lockup that already
 * contains the wordmark, so the header's logo-plus-text pairing would
 * print the name twice here, where the mark is large enough to read.
 */
function Mark() {
  return (
    <Link to="/" className="inline-flex flex-col items-start" aria-label="ZION Herbs, home">
      <Img src="/brand/logo-dark.png" alt="ZION Herbs" className="h-[92px] w-auto" priority />
      <span className="mt-3.5 text-micro uppercase tracking-[0.3em] text-gold">Admin panel</span>
    </Link>
  )
}

/**
 * Form on paper at the left, a tea on the right.
 *
 * The picture is lg-only: on a phone it would push the fields below the
 * fold, and nobody signing in at a counter wants to scroll past a
 * photograph to reach a password box.
 */
function Frame({ children }) {
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[1fr_0.85fr]">
      <div className="flex min-h-screen items-center justify-center px-6 py-14 sm:px-10 lg:min-h-0">
        <div className="w-full max-w-[38ch]">{children}</div>
      </div>

      {/* Typographic, not photographic, and that is deliberate: every
          product image in this shop is a marketing poster -- headline,
          benefit list, a WhatsApp number -- so anything set over one
          collides with type that is already there. This panel is built
          from the brand's own colours instead, and costs nothing to
          load. */}
      <div className="relative hidden overflow-hidden border-l border-line bg-surface lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 85% 8%, rgb(var(--c-gold-lit) / 0.30) 0%, transparent 58%),' +
              'radial-gradient(90% 70% at 10% 100%, rgb(var(--c-gold) / 0.14) 0%, transparent 60%)',
          }}
        />

        {/* Faint texture, not a second logo. Kept fully inside the panel:
            cropped at the edge it reads as a mistake rather than a
            watermark. */}
        <Img
          src="/brand/logo-dark.png"
          alt=""
          className="pointer-events-none absolute bottom-32 right-14 h-[34%] w-auto opacity-[0.055]"
        />

        <div className="relative flex h-full flex-col p-14">
          <p className="text-micro uppercase tracking-[0.3em] text-soft">ZION Herbs · Admin</p>

          <div className="my-auto">
            <p className="font-script text-[3.4rem] leading-[0.95] text-gold">
              Six nature,
              <br />
              one wellness
            </p>
            <p className="mt-6 max-w-[34ch] text-lede leading-relaxed text-soft">
              Whole flowers and roots, hand-packed in Tamil Nadu. Nothing added, and nothing
              that needs hiding.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-line pt-7">
            {[
              ['Six', 'single-origin'],
              ['Zero', 'caffeine'],
              ['One', 'botanical each'],
            ].map(([big, small]) => (
              <div key={small}>
                <dt className="font-display text-[1.5rem] leading-none">{big}</dt>
                <dd className="mt-1.5 text-tiny text-soft">{small}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
