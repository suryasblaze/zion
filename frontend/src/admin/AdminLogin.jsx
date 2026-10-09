import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/StoreProvider'

/** Own title, and kept out of search results -- a staff door does not
 *  belong in an index, and inheriting the shop's title made the tab read
 *  as though you were still shopping. */
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

/**
 * Staff sign-in, at /admin/login.
 *
 * Deliberately not the shop's /signin. Same accounts and same endpoint --
 * there is one user table and the role decides access, which is where the
 * real check lives -- but a customer arriving at the shop's sign-in and a
 * manager opening the panel are two different errands, and one page
 * serving both left the panel feeling like a page customers had wandered
 * off. This one carries the panel's own dark chrome, says "staff", and
 * sends you to /admin rather than to an account page.
 *
 * It is not a security boundary and does not pretend to be one. Every
 * /api/admin/* route checks the role on its own; this page would be
 * pointless as protection and is purely about not making people guess
 * which door is theirs.
 */
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

  if (!ready) return <Screen><p className="text-white/50">Loading…</p></Screen>

  // Already signed in with the rights: go straight through rather than
  // showing a form to someone who does not need it.
  if (isStaff(user)) return <Navigate to={next} replace />

  // Signed in, but as a shopper. Saying so beats a failed login they
  // cannot explain, and the way out is to sign out, not to try again.
  if (user)
    return (
      <Screen>
        <div className="w-full max-w-[36ch] text-center">
          <h1 className="font-display text-[1.5rem] text-white">This account has no panel access</h1>
          <p className="mt-3 text-[0.93rem] leading-relaxed text-white/55">
            You are signed in as {user.email}. Sign out and use the account ZION set up for you.
          </p>
          <button
            onClick={() => { logout(); setNotice(null) }}
            className="mt-7 w-full rounded bg-gold py-3 text-paper transition hover:brightness-110"
          >
            Sign out
          </button>
          <Link to="/" className="mt-4 block text-tiny text-white/40 hover:text-white/70">
            Back to the shop
          </Link>
        </div>
      </Screen>
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
        setNotice('That account is a customer account. It cannot open the panel.')
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
    <Screen>
      <div className="w-full max-w-[34ch]">
        <div className="mb-9 text-center">
          <p className="font-display text-[1.35rem] tracking-[0.26em] text-white">ZION</p>
          <p className="mt-1 text-micro uppercase tracking-[0.3em] text-gold">Admin</p>
        </div>

        {notice && (
          <p
            role="alert"
            className="mb-5 rounded border-l-2 border-[#B4472F] bg-white/[0.04] px-4 py-3 text-[0.9rem] text-white/80"
          >
            {notice}
          </p>
        )}

        <form onSubmit={submit} noValidate>
          <Field
            id="email" label="Email" type="email" autoComplete="username"
            value={form.email} onChange={set('email')} err={errors.email} autoFocus
          />

          <div className="mt-4">
            <label htmlFor="password" className="mb-2 block text-micro uppercase tracking-[0.14em] text-white/40">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={set('password')}
                className={`w-full rounded border bg-white/[0.04] px-4 py-3 pr-16 text-white
                            placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-gold/50
                            ${errors.password ? 'border-[#B4472F]' : 'border-white/15 focus:border-gold/60'}`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tiny text-white/40 hover:text-white/80"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-tiny text-[#E08D78]">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded bg-gold py-3.5
                       text-paper transition hover:brightness-110 disabled:opacity-60"
          >
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
                Sign in
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-tiny text-white/30">
          Staff only. Shopping?{' '}
          <Link to="/signin" className="text-white/55 underline underline-offset-4 hover:text-white">
            Customer sign-in
          </Link>
        </p>
      </div>
    </Screen>
  )
}

/* The panel's own dark ground, so this never reads as a shop page. */
function Screen({ children }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#171310] px-6">
      {children}
    </div>
  )
}

function Field({ id, label, err, ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-micro uppercase tracking-[0.14em] text-white/40">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        className={`w-full rounded border bg-white/[0.04] px-4 py-3 text-white
                    placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-gold/50
                    ${err ? 'border-[#B4472F]' : 'border-white/15 focus:border-gold/60'}`}
      />
      {err && <p className="mt-1.5 text-tiny text-[#E08D78]">{err}</p>}
    </div>
  )
}
