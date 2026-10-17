import { useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import { api } from '../lib/api'

/**
 * Ask for a reset link.
 *
 * The server answers the same whether or not the address has an account,
 * and so does this page. Showing "no such account" here would turn the
 * form into a way to ask whether someone shops at ZION and get a
 * reliable answer -- a privacy leak before it is a security one.
 *
 * So on success the form is replaced with the same confirmation every
 * time, and there is nothing to retry against.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Enter the email address on your account.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.forgotPassword({ email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(err.payload?.errors?.email || err.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Seo title="Forgot your password — ZION Herbs" noindex />

      <section className="shell grid min-h-[60vh] place-items-center py-16">
        <div className="w-full max-w-[42ch]">
          {sent ? (
            <>
              <p className="script mb-1">Check your inbox</p>
              <h1 className="text-d2">The link is on its way</h1>
              <p className="mt-5 text-soft">
                If <span className="text-ink">{email}</span> has an account, a reset link has
                been sent. It works once and expires in an hour.
              </p>
              <p className="mt-4 text-tiny text-soft">
                Nothing after a few minutes? Check your spam folder, and that you typed the
                address you ordered with.
              </p>
              <Link to="/signin" className="btn btn-solid mt-8">Back to sign in</Link>
            </>
          ) : (
            <>
              <p className="script mb-1">It happens</p>
              <h1 className="text-d2">Forgot your password</h1>
              <p className="mt-4 text-soft">
                Type the address on your account and we will send a link to set a new one.
              </p>

              {error && (
                <p
                  role="alert"
                  className="mt-6 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.06] px-4 py-3 text-[0.92rem] text-[#8F3623]"
                >
                  {error}
                </p>
              )}

              <form onSubmit={submit} className="mt-7" noValidate>
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  className="field py-3.5"
                />
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
                      Sending…
                    </>
                  ) : (
                    'Send the link'
                  )}
                </button>
              </form>

              <p className="mt-7 border-t border-line pt-5 text-tiny text-soft">
                Remembered it?{' '}
                <Link to="/signin" className="text-gold underline underline-offset-4">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  )
}
