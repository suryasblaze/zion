import { useCallback, useEffect, useState } from 'react'
import { adminApi } from './adminApi'
import { Empty, PageHead, Pill, Toast } from './AdminShell'
import { inr, num } from '../lib/format'

export default function Customers() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(null)
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
      <PageHead title="Customers" sub="Accounts, what they have spent, and their coin balances." />

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
