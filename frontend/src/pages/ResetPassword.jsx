import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Seo from '../components/Seo'
import { api } from '../lib/api'

/**
 * Set a new password from an emailed link.
 *
 * The token is checked on arrival, before the form is shown. Letting
 * someone type a new password twice and only then saying "this link
 * expired" wastes the one thing they have -- and by then the link they
 * would need to request a fresh one is two pages away.
 */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [state, setState] = useState('checking')   // checking | ready | invalid | done
  const [hint, setHint] = useState(null)
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }
    api
      .checkResetToken(token)
      .then((res) => {
        setHint(res?.email_hint || null)
        setState('ready')
      })
      .catch(() => setState('invalid'))
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    if (!value) {
      setError('Choose a new password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.resetPassword({ token, password: value })
      setState('done')
      // Long enough to read the confirmation, short enough that nobody
      // wonders whether it worked.
      setTimeout(() => navigate('/signin', { replace: true }), 2600)
    } catch (err) {
      // An expired token mid-form is not a field error: the form is no
      // longer usable, so swap it for the way out.
      if (err.payload?.code === 'reset_invalid') {
        setState('invalid')
      } else {
        setError(err.payload?.errors?.password || err.message || 'Something went wrong.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Seo title="Set a new password — ZION Herbs" noindex />

      <section className="shell grid min-h-[60vh] place-items-center py-16">
        <div className="w-full max-w-[42ch]">
          {state === 'checking' && <p className="script">Checking your link…</p>}

          {state === 'invalid' && (
            <>
              <p className="script mb-1">That link is spent</p>
              <h1 className="text-d2">This link no longer works</h1>
              <p className="mt-5 text-soft">
                Links last an hour and work once. If you asked more than once,{' '}
                <span className="text-ink">only the newest email works</span> — check for a
                more recent one before asking again.
              </p>
              <Link to="/forgot-password" className="btn btn-gold mt-8">Send a new link</Link>
            </>
          )}

          {state === 'done' && (
            <>
              <p className="script mb-1">All set</p>
              <h1 className="text-d2">Your password is changed</h1>
              <p className="mt-5 text-soft">
                Taking you to sign in. Any other reset links you were sent no longer work.
              </p>
              <Link to="/signin" className="btn btn-solid mt-8">Sign in now</Link>
            </>
          )}

          {state === 'ready' && (
            <>
              <p className="script mb-1">Almost done</p>
              <h1 className="text-d2">Set a new password</h1>
              {hint && (
                <p className="mt-4 text-soft">
                  For <span className="text-ink">{hint}</span>
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-6 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.06] px-4 py-3 text-[0.92rem] text-[#8F3623]"
                >
                  {error}
                </p>
              )}

              <form onSubmit={submit} className="mt-7" noValidate>
                <label className="label" htmlFor="new-password">New password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(null) }}
                    className="field py-3.5 pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-tiny text-soft hover:text-ink"
                  >
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-1.5 text-tiny text-soft">
                  At least 8 characters, including a number.
                </p>

                <button
                  type="submit"
                  disabled={busy}
                  className="btn btn-gold mt-5 w-full disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <span
                        className="h-4 w-4 rounded-full border-2 border-paper/30 border-t-paper"
                        style={{ animation: 'spin 0.7s linear infinite' }}
                      />
                      Saving…
                    </>
                  ) : (
                    'Save and sign in'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </>
  )
}
