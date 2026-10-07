import { useCallback, useEffect, useState } from 'react'
import { adminApi } from './adminApi'
import { Empty, PageHead, Pill, Toast } from './AdminShell'
import { inr, num } from '../lib/format'

export default function Customers() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows((await adminApi.customers(search ? `?q=${encodeURIComponent(search)}` : '')) || [])
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (row) => {
    const verb = row.is_active ? 'Disable' : 'Re-enable'
    if (!window.confirm(`${verb} ${row.full_name || row.email}?`)) return
    try {
      await adminApi.updateCustomer(row.id, { is_active: !row.is_active })
      setToast({ text: `${verb}d.` })
      load()
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    }
  }

  return (
    <>
      <PageHead
        title="Customers"
        sub="Accounts, what they have spent, and their coin balances. Visitors cannot register themselves, so accounts are made here."
      >
        <button onClick={() => setCreating(true)} className="btn btn-solid px-5 py-2.5 text-tiny">
          Add account
        </button>
      </PageHead>

      <div className="p-6 lg:p-9">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or referral code…"
          className="field mb-5 max-w-[320px] py-2"
        />

        {loading ? (
          <p className="py-12 text-center text-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty title="No customers yet" body="Accounts appear here as people register." />
        ) : (
          <div className="overflow-x-auto border border-line bg-paper">
            <table className="w-full min-w-[880px] text-left text-[0.9rem]">
              <thead className="border-b border-line bg-surface text-micro uppercase tracking-wide text-soft">
                <tr>
                  <th className="px-4 py-3 font-normal">Customer</th>
                  <th className="px-4 py-3 font-normal">Referral code</th>
                  <th className="px-4 py-3 text-right font-normal">Orders</th>
                  <th className="px-4 py-3 text-right font-normal">Spent</th>
                  <th className="px-4 py-3 text-right font-normal">Referred</th>
                  <th className="px-4 py-3 text-right font-normal">Coins</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                    <td className="max-w-[220px] px-4 py-3">
                      <span className="block truncate">{c.full_name || '—'}</span>
                      <span className="block truncate text-micro text-soft">{c.email}</span>
                      {c.referred_by_name && (
                        <span className="block text-micro text-gold">invited by {c.referred_by_name}</span>
                      )}
                    </td>
                    <td className="nums px-4 py-3 text-soft">{c.referral_code}</td>
                    <td className="nums px-4 py-3 text-right">{num(c.orders)}</td>
                    <td className="nums px-4 py-3 text-right">{inr(c.spent)}</td>
                    <td className="nums px-4 py-3 text-right">{num(c.referrals)}</td>
                    <td className="nums px-4 py-3 text-right">{num(c.wallet_balance)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={c.is_active ? 'good' : 'bad'}>{c.is_active ? 'Active' : 'Disabled'}</Pill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => setAdjusting(c)} className="text-gold hover:underline">Coins</button>
                      <button onClick={() => toggleActive(c)} className="ml-4 text-soft hover:text-[#8F3623]">
                        {c.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <NewAccount
          onClose={() => setCreating(false)}
          onDone={(msg) => {
            setToast({ text: msg })
            setCreating(false)
            load()
          }}
        />
      )}

      {adjusting && (
        <AdjustCoins
          customer={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={(msg) => {
            setToast({ text: msg })
            setAdjusting(null)
            load()
          }}
          onError={(msg) => setToast({ text: msg, tone: 'error' })}
        />
      )}

      {toast && <Toast tone={toast.tone} onDone={() => setToast(null)}>{toast.text}</Toast>}
    </>
  )
}

/**
 * A password for an account someone else will use.
 *
 * Two requirements pull against each other: it gets read down a phone, so
 * it has to be dictatable; and it may never be changed, so it has to hold
 * up on its own.
 *
 * Four groups of four from a 29-character alphabet is about 78 bits. That
 * holds up even if the password is never rotated, which is the case worth
 * designing for -- an admin-issued password often is not. Grouping keeps
 * it dictatable, and the alphabet drops 0/O/1/I/L/S/5 because those are
 * what get misheard and mistyped.
 *
 * crypto.getRandomValues, not Math.random: Math.random is not a CSPRNG and
 * its internal state can be recovered from its own output. An earlier
 * version of this picked one of six words and a four-digit number, which
 * is 54,000 possibilities -- brute-forceable against a login endpoint in
 * days.
 */
const PW_ALPHABET = '2346789ABCDEFGHJKMNPQRTUVWXYZ'   // 29 characters

function suggestPassword() {
  const need = 16
  const out = []

  // Rejection sampling. Taking a byte modulo 29 would make the first nine
  // characters of the alphabet slightly likelier than the rest, which is a
  // small bias but a free one to avoid.
  const limit = 256 - (256 % PW_ALPHABET.length)
  while (out.length < need) {
    const bytes = new Uint8Array(need * 2)
    crypto.getRandomValues(bytes)
    for (const b of bytes) {
      if (out.length === need) break
      if (b < limit) out.push(PW_ALPHABET[b % PW_ALPHABET.length])
    }
  }

  // Grouped for dictation, and a digit is guaranteed because the server
  // asks for one.
  const groups = [
    out.slice(0, 4), out.slice(4, 8), out.slice(8, 12), out.slice(12, 16),
  ].map((g) => g.join(''))
  return `Zion-${groups.join('-')}`
}

/**
 * Creating an account by hand.
 *
 * The role is an explicit choice with customer preselected. An account
 * that can read every order and move wallet balances should be a decision
 * someone made, not what happens when a field is left alone.
 */
function NewAccount({ onClose, onDone }) {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', role: 'customer',
  })
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
    setProblem(null)
  }

  const suggest = () => {
    setForm((f) => ({ ...f, password: suggestPassword() }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setProblem(null)
    try {
      const row = await adminApi.createCustomer(form)
      onDone(`Account created for ${row.full_name}. They can sign in now.`)
    } catch (err) {
      setErrors(err.payload?.errors || {})
      setProblem(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[55] bg-ink/30" aria-hidden="true" />
      <aside
        role="dialog"
        aria-label="New account"
        className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-[520px] flex-col bg-paper shadow-[-18px_0_50px_rgba(23,19,16,0.14)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-[1.25rem]">New account</h2>
          <button onClick={onClose} className="text-soft hover:text-ink" aria-label="Close">✕</button>
        </header>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {problem && (
              <p className="mb-5 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.05] px-4 py-3 text-tiny text-[#8F3623]">
                {problem}
              </p>
            )}

            <div className="grid gap-5">
              <F id="n_full_name" label="Name" value={form.full_name} onChange={set('full_name')} err={errors.full_name} required />
              <F id="n_email" label="Email" type="email" value={form.email} onChange={set('email')} err={errors.email}
                 hint="This is what they sign in with." required />
              <F id="n_phone" label="Phone" value={form.phone} onChange={set('phone')} err={errors.phone} hint="Optional." />

              <div>
                <label className="label" htmlFor="n_password">Password</label>
                <div className="flex gap-2">
                  <input
                    id="n_password"
                    value={form.password}
                    onChange={set('password')}
                    className={`field ${errors.password ? 'border-[#B4472F]' : ''}`}
                  />
                  <button type="button" onClick={suggest} className="btn btn-ghost shrink-0 px-4 py-2.5 text-tiny">
                    Suggest
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-1.5 text-tiny text-[#8F3623]">{errors.password}</p>
                ) : (
                  <p className="mt-1.5 text-tiny text-soft">
                    At least 8 characters with a number. Suggest makes a strong one in groups,
                    so it can be read out over the phone. Ask them to change it once they are in.
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="n_role">Role</label>
                <select id="n_role" value={form.role} onChange={set('role')} className="field">
                  <option value="customer">Customer — shop, wallet, referral link</option>
                  <option value="staff">Staff — full admin access</option>
                  <option value="admin">Admin — full admin access</option>
                </select>
                <p className="mt-1.5 text-tiny text-soft">
                  Staff and admin both see every order and customer, and can change settings.
                  Only choose them for people who should.
                </p>
              </div>
            </div>
          </div>

          <footer className="flex items-center gap-3 border-t border-line px-6 py-4">
            <button disabled={busy} className="btn btn-solid px-6 py-2.5 disabled:opacity-50">
              {busy ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost px-6 py-2.5">Cancel</button>
          </footer>
        </form>
      </aside>
    </>
  )
}

function F({ id, label, err, hint, ...props }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className={`field ${err ? 'border-[#B4472F]' : ''}`} {...props} />
      {err ? (
        <p className="mt-1.5 text-tiny text-[#8F3623]">{err}</p>
      ) : hint ? (
        <p className="mt-1.5 text-tiny text-soft">{hint}</p>
      ) : null}
    </div>
  )
}

function AdjustCoins({ customer, onClose, onDone, onError }) {
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await adminApi.adjustWallet(customer.id, { points: Number(points), note })
      onDone(`${Math.abs(Number(points)).toLocaleString('en-IN')} coins ${Number(points) > 0 ? 'added' : 'removed'}.`)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[55] bg-ink/30" aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-[56] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-line bg-paper p-7 shadow-[0_20px_60px_rgba(23,19,16,0.2)]">
        <h2 className="font-display text-[1.25rem]">Adjust coins</h2>
        <p className="mt-1 text-soft">
          {customer.full_name || customer.email} has{' '}
          <span className="nums text-ink">{num(customer.wallet_balance)}</span> coins.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-5">
          <div>
            <label className="label" htmlFor="pts">Points to add or remove</label>
            <input
              id="pts"
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="e.g. 200, or -200 to take away"
              className="field nums"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="note">Why</label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Goodwill after a delayed delivery"
              className="field"
              required
            />
            <p className="mt-1.5 text-tiny text-soft">
              Recorded in the customer's wallet history and the audit log.
            </p>
          </div>

          <div className="flex gap-3">
            <button disabled={busy || !points || !note} className="btn btn-solid px-6 py-2.5 disabled:opacity-50">
              {busy ? 'Saving…' : 'Apply'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost px-6 py-2.5">Cancel</button>
          </div>
        </form>
      </div>
    </>
  )
}
