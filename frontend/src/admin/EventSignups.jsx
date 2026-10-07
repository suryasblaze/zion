import { useCallback, useEffect, useState } from 'react'
import { adminApi } from './adminApi'
import { Empty, PageHead, Pill, Toast } from './AdminShell'
import { num } from '../lib/format'

/**
 * Event sign-ups.
 *
 * Two jobs on one screen. At the counter, staff type the code someone is
 * holding up and hand over the sample. Afterwards, the tally answers the
 * question the event was run to answer: which tea do people reach for.
 */
const FILTERS = [
  ['all', 'Everyone'],
  ['pending', 'Not collected'],
  ['claimed', 'Collected'],
]

export default function EventSignups() {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  const [tally, setTally] = useState([])
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [code, setCode] = useState('')
  const [found, setFound] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = `?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ''}`
      const res = await adminApi.eventSignups(q)
      setRows(res.rows || [])
      setStats(res.stats || null)
      setTally(res.tally || [])
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [status, search])

  useEffect(() => {
    load()
  }, [load])

  const claim = async (row) => {
    setBusyId(row.id)
    try {
      await adminApi.claimSignup(row.id)
      setToast({ text: `Handed to ${row.full_name}.` })
      setFound(null)
      setCode('')
      load()
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const unclaim = async (row) => {
    if (!window.confirm(`Put ${row.full_name} back to not collected?`)) return
    try {
      await adminApi.unclaimSignup(row.id)
      setToast({ text: 'Put back to pending.' })
      load()
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    }
  }

  const lookup = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setFound(null)
    try {
      setFound(await adminApi.lookupSignup(code.trim()))
    } catch (err) {
      setToast({ text: err.message, tone: 'error' })
    }
  }

  const exportCsv = () => {
    const head = ['Name', 'Phone', 'Email', 'Tea', 'Code', 'Status', 'Signed up']
    const body = rows.map((r) => [
      r.full_name, r.phone, r.email || '', r.product_name, r.claim_code, r.status,
      new Date(r.created_at).toLocaleString('en-IN'),
    ])
    // Quote every field: names contain commas more often than you expect.
    const csv = [head, ...body]
      .map((cols) => cols.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `zion-signups-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHead
        title="Event sign-ups"
        sub="Look up a code to hand over a sample, and see which tea people are choosing."
      >
        <button onClick={exportCsv} disabled={!rows.length} className="btn btn-ghost px-5 py-2.5 text-tiny disabled:opacity-40">
          Export CSV
        </button>
      </PageHead>

      <div className="p-6 lg:p-9">
        {/* ------------------------------------------- counter lookup */}
        <section className="mb-9 border border-line bg-paper p-6">
          <h2 className="font-display text-[1.15rem]">At the counter</h2>
          <p className="mt-1 text-soft">Type the code on their screen.</p>

          <form onSubmit={lookup} className="mt-4 flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ZN-4K7Q"
              className="field nums max-w-[220px] text-[1.1rem] tracking-[0.12em]"
              aria-label="Claim code"
            />
            <button className="btn btn-solid px-6 py-2.5">Find</button>
          </form>

          {found && (
            <div
              className="mt-5 flex flex-wrap items-center justify-between gap-4 border-l-2 bg-surface px-5 py-4"
              style={{ borderLeftColor: found.accent_color || '#8F7222' }}
            >
              <div>
                <p className="font-display text-[1.2rem]">{found.full_name}</p>
                <p className="nums text-tiny text-soft">
                  {found.phone} · {found.product_name} · {found.claim_code}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={found.status} />
                {found.status === 'pending' ? (
                  <button
                    onClick={() => claim(found)}
                    disabled={busyId === found.id}
                    className="btn btn-solid px-6 py-2.5 text-tiny disabled:opacity-50"
                  >
                    Hand it over
                  </button>
                ) : (
                  <span className="nums text-tiny text-soft">
                    collected{' '}
                    {found.claimed_at &&
                      new Date(found.claimed_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------ the numbers */}
        {stats && (
          <dl className="mb-9 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Sign-ups', stats.total],
              ['Not collected', stats.pending],
              ['Collected', stats.claimed],
              ['In the last 24 hours', stats.today],
            ].map(([label, value]) => (
              <div key={label} className="border-b border-r border-line bg-paper p-6">
                <dt className="text-tiny text-soft">{label}</dt>
                <dd className="nums mt-1 font-display text-[2rem]">{num(value)}</dd>
              </div>
            ))}
          </dl>
        )}

        {tally.length > 0 && (
          <section className="mb-9">
            <h2 className="mb-3 font-display text-[1.15rem]">Which tea they chose</h2>
            <div className="border border-line bg-paper p-6">
              {tally.map((t) => {
                const pct = stats?.total ? Math.round((t.signups / stats.total) * 100) : 0
                return (
                  <div key={t.product_name} className="mb-3 last:mb-0">
                    <div className="mb-1 flex items-baseline justify-between gap-4 text-[0.92rem]">
                      <span>{t.product_name}</span>
                      <span className="nums text-soft">
                        {num(t.signups)} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: t.accent_color || '#8F7222' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ------------------------------------------------- the list */}
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              className={`border-b pb-0.5 text-[0.92rem] transition-colors ${
                status === key ? 'border-gold text-gold' : 'border-transparent text-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, number or code…"
            className="field ml-auto max-w-[280px] py-2"
          />
        </div>

        {loading ? (
          <p className="py-12 text-center text-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty
            title="Nobody yet"
            body="Sign-ups appear here the moment someone fills in the form. Share the link: /try"
          />
        ) : (
          <div className="overflow-x-auto border border-line bg-paper">
            <table className="w-full min-w-[820px] text-left text-[0.9rem]">
              <thead className="border-b border-line bg-surface text-micro uppercase tracking-wide text-soft">
                <tr>
                  <th className="px-4 py-3 font-normal">Who</th>
                  <th className="px-4 py-3 font-normal">Chose</th>
                  <th className="px-4 py-3 font-normal">Code</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Signed up</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <span className="block">{r.full_name}</span>
                      <span className="nums block text-micro text-soft">
                        {r.phone}
                        {r.email ? ` · ${r.email}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-5 w-[3px] shrink-0"
                          style={{ background: r.accent_color || '#8F7222' }}
                        />
                        {r.product_name}
                      </span>
                    </td>
                    <td className="nums px-4 py-3 tracking-wide">{r.claim_code}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="nums px-4 py-3 text-soft">
                      {new Date(r.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {r.status === 'pending' ? (
                        <button
                          onClick={() => claim(r)}
                          disabled={busyId === r.id}
                          className="text-gold hover:underline disabled:opacity-50"
                        >
                          Hand it over
                        </button>
                      ) : r.status === 'claimed' ? (
                        <button onClick={() => unclaim(r)} className="text-soft hover:text-ink">
                          Undo
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast tone={toast.tone} onDone={() => setToast(null)}>{toast.text}</Toast>}
    </>
  )
}

function StatusPill({ status }) {
  const map = {
    pending: ['gold', 'Waiting'],
    claimed: ['good', 'Collected'],
    cancelled: ['neutral', 'Cancelled'],
    expired: ['neutral', 'Expired'],
  }
  const [tone, label] = map[status] || map.pending
  return <Pill tone={tone}>{label}</Pill>
}
