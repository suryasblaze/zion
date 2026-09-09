import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi } from './adminApi'
import { Empty, PageHead, Pill, Toast } from './AdminShell'
import { inr, num } from '../lib/format'

const FILTERS = [
  ['all', 'Everything'],
  ['pending', 'Waiting on an order'],
  ['qualified', 'Ready to pay'],
  ['rewarded', 'Paid'],
  ['rejected', 'Rejected'],
  ['reversed', 'Reversed'],
]

const FLAG_TEXT = {
  same_ip_as_referrer: 'Same network as the referrer',
  same_device_as_referrer: 'Same device as the referrer',
  same_email_root: 'Email resolves to the referrer’s inbox',
  referrer_at_reward_cap: 'Referrer has hit the reward cap',
}

export default function Referrals() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const status = params.get('status') || 'all'
  const flagged = params.get('flagged') === '1'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = `?status=${status}${flagged ? '&flagged=1' : ''}`
      setRows((await adminApi.referrals(q)) || [])
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [status, flagged])

  useEffect(() => {
    load()
  }, [load])

  const act = async (id, kind) => {
    if (kind === 'reject') {
      const reason = window.prompt('Why are you rejecting this referral?')
      if (!reason) return
      setBusyId(id)
      try {
        await adminApi.rejectReferral(id, reason)
        setToast({ text: 'Referral rejected.' })
        load()
      } catch (e) {
        setToast({ text: e.message, tone: 'error' })
      } finally {
        setBusyId(null)
      }
      return
    }

    setBusyId(id)
    try {
      const res = await adminApi.approveReferral(id)
      setToast({ text: `${num(res.points)} points paid to the referrer.` })
      load()
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const payDue = async () => {
    try {
      const res = await adminApi.processDue()
      setToast({ text: `${res.paid} reward${res.paid === 1 ? '' : 's'} paid.` })
      load()
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    }
  }

  return (
    <>
      <PageHead
        title="Referrals"
        sub="Every referral, its state, and anything the fraud checks held back for you to look at."
      >
        <button onClick={payDue} className="btn btn-ghost px-5 py-2.5 text-tiny">
          Pay due rewards
        </button>
      </PageHead>

      <div className="p-6 lg:p-9">
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setParams(key === 'all' ? {} : { status: key })}
              className={`border-b pb-0.5 text-[0.92rem] transition-colors ${
                status === key && !flagged
                  ? 'border-gold text-gold'
                  : 'border-transparent text-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setParams({ flagged: '1' })}
            className={`ml-auto border px-3 py-1.5 text-tiny transition-colors ${
              flagged
                ? 'border-[#B4472F] bg-[#B4472F]/[0.06] text-[#8F3623]'
                : 'border-line text-soft hover:border-[#B4472F] hover:text-[#8F3623]'
            }`}
          >
            Held for review
          </button>
        </div>

        {loading ? (
          <p className="py-12 text-center text-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty
            title="Nothing here"
            body={
              flagged
                ? 'No referrals are waiting on a decision. That is the good outcome.'
                : 'No referrals match this filter yet.'
            }
          />
        ) : (
          <div className="grid gap-px border border-line bg-line">
            {rows.map((r) => {
              const flags = r.fraud_flags || []
              return (
                <article key={r.id} className="bg-paper p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.95rem]">
                        <span className="text-ink">{r.referrer_name}</span>
                        <span className="px-2 text-soft">referred</span>
                        <span className="text-ink">{r.referee_name}</span>
                      </p>
                      <p className="nums mt-1 text-tiny text-soft">
                        {r.code} · joined{' '}
                        {new Date(r.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                        {r.order_number && ` · order ${r.order_number} (${inr(r.order_total)})`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill status={r.status} />
                      {r.referrer_points_awarded > 0 && (
                        <span className="nums text-tiny text-soft">
                          {num(r.referrer_points_awarded)} points paid
                        </span>
                      )}
                    </div>
                  </div>

                  {flags.length > 0 && r.status !== 'rewarded' && (
                    <div className="mt-4 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.04] px-4 py-3">
                      <p className="text-tiny text-[#8F3623]">
                        Held for review — {flags.map((f) => FLAG_TEXT[f] || f).join('; ')}.
                      </p>
                      <p className="mt-1 text-micro text-soft">
                        {r.qualifying_order_id
                          ? 'Their order has been paid, so approving this pays the referrer now.'
                          : 'No qualifying order yet. You can approve once they have ordered.'}
                      </p>
                    </div>
                  )}

                  {(flags.length > 0 || r.status === 'qualified') && r.status !== 'rewarded' &&
                   r.status !== 'rejected' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        disabled={busyId === r.id || !r.qualifying_order_id}
                        onClick={() => act(r.id, 'approve')}
                        className="btn btn-solid px-5 py-2 text-tiny disabled:opacity-40"
                        title={!r.qualifying_order_id ? 'No qualifying order yet' : undefined}
                      >
                        {busyId === r.id ? 'Paying…' : 'Approve and pay'}
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, 'reject')}
                        className="btn btn-ghost px-5 py-2 text-tiny"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {r.rejected_reason && (
                    <p className="mt-3 text-tiny text-soft">Note: {r.rejected_reason}</p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <Toast tone={toast.tone} onDone={() => setToast(null)}>
          {toast.text}
        </Toast>
      )}
    </>
  )
}

function StatusPill({ status }) {
  const map = {
    pending: ['neutral', 'Waiting on first order'],
    qualified: ['gold', 'Ready to pay'],
    rewarded: ['good', 'Paid'],
    rejected: ['neutral', 'Rejected'],
    reversed: ['bad', 'Reversed'],
  }
  const [tone, label] = map[status] || map.pending
  return <Pill tone={tone}>{label}</Pill>
}
