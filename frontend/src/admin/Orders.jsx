import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi } from './adminApi'
import { Empty, PageHead, Pill, Toast } from './AdminShell'
import { inr, num } from '../lib/format'

const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  const status = params.get('status') || 'all'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = `?status=${status}${search ? `&q=${encodeURIComponent(search)}` : ''}`
      setRows((await adminApi.orders(q)) || [])
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [status, search])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <PageHead
        title="Orders"
        sub="Marking an order paid or delivered is what releases the referrer's reward, so it happens here."
      />

      <div className="p-6 lg:p-9">
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            onClick={() => setParams({})}
            className={`border-b pb-0.5 text-[0.92rem] ${status === 'all' ? 'border-gold text-gold' : 'border-transparent text-soft hover:text-ink'}`}
          >
            Everything
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setParams({ status: s })}
              className={`border-b pb-0.5 text-[0.92rem] capitalize ${status === s ? 'border-gold text-gold' : 'border-transparent text-soft hover:text-ink'}`}
            >
              {s}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, email or phone…"
            className="field ml-auto max-w-[290px] py-2"
          />
        </div>

        {loading ? (
          <p className="py-12 text-center text-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty title="No orders here" body="Nothing matches this filter yet." />
        ) : (
          <div className="overflow-x-auto border border-line bg-paper">
            <table className="w-full min-w-[860px] text-left text-[0.9rem]">
              <thead className="border-b border-line bg-surface text-micro uppercase tracking-wide text-soft">
                <tr>
                  <th className="px-4 py-3 font-normal">Order</th>
                  <th className="px-4 py-3 font-normal">Customer</th>
                  <th className="px-4 py-3 text-right font-normal">Items</th>
                  <th className="px-4 py-3 text-right font-normal">Total</th>
                  <th className="px-4 py-3 font-normal">Payment</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Placed</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                    <td className="nums px-4 py-3">
                      <span className="block">{o.order_number}</span>
                      {o.referral_code_used && (
                        <span className="block text-micro text-gold">via {o.referral_code_used}</span>
                      )}
                    </td>
                    <td className="max-w-[190px] px-4 py-3">
                      <span className="block truncate">{o.full_name || '—'}</span>
                      <span className="block truncate text-micro text-soft">{o.email}</span>
                    </td>
                    <td className="nums px-4 py-3 text-right text-soft">{num(o.item_count)}</td>
                    <td className="nums px-4 py-3 text-right">
                      <span className="block">{inr(o.total)}</span>
                      {(Number(o.coins_redeemed) > 0 || Number(o.referral_discount) > 0) && (
                        <span className="block text-micro text-soft">
                          {Number(o.referral_discount) > 0 && `−${inr(o.referral_discount)} referral `}
                          {Number(o.coins_redeemed) > 0 && `−${inr(o.coins_value)} coins`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={o.payment_status === 'paid' ? 'good' : o.payment_status === 'refunded' ? 'bad' : 'neutral'}>
                        {o.payment_status}
                      </Pill>
                      <span className="mt-1 block text-micro uppercase text-soft">{o.payment_method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={o.status === 'delivered' ? 'good' : o.status === 'cancelled' ? 'bad' : 'gold'}>
                        {o.status}
                      </Pill>
                    </td>
                    <td className="nums px-4 py-3 text-soft">
                      {new Date(o.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setOpen(o)} className="text-gold hover:underline">Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <OrderDrawer
          order={open}
          onClose={() => setOpen(null)}
          onSaved={(msg) => {
            setToast({ text: msg })
            setOpen(null)
            load()
          }}
          onError={(msg) => setToast({ text: msg, tone: 'error' })}
        />
      )}

      {toast && <Toast tone={toast.tone} onDone={() => setToast(null)}>{toast.text}</Toast>}
    </>
  )
}

function OrderDrawer({ order, onClose, onSaved, onError }) {
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({
    status: order.status,
    payment_status: order.payment_status,
    tracking_number: order.tracking_number || '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminApi.order(order.id).then(setDetail).catch(() => setDetail(null))
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [order.id, onClose])

  const willReward =
    form.payment_status === 'paid' && order.payment_status !== 'paid' && order.referral_code_used

  const save = async () => {
    setBusy(true)
    try {
      const res = await adminApi.updateOrder(order.id, form)
      let msg = 'Order updated.'
      if (res.referral?.rewarded) msg += ` ${num(res.referral.points)} points paid to the referrer.`
      else if (res.referral?.reason === 'held_for_review')
        msg += ' The referral was held for review — see Referrals.'
      onSaved(msg)
    } catch (e) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const addr = detail?.shipping_address || order.shipping_address || {}

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[55] bg-ink/30" aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-[560px] flex-col bg-paper shadow-[-18px_0_50px_rgba(23,19,16,0.14)]">
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="nums font-display text-[1.25rem]">{order.order_number}</h2>
            <p className="nums text-tiny text-soft">
              {new Date(order.placed_at).toLocaleString('en-IN')}
            </p>
          </div>
          <button onClick={onClose} className="text-soft hover:text-ink" aria-label="Close">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <section className="mb-7">
            <h3 className="label">Deliver to</h3>
            <p className="text-[0.95rem]">{addr.full_name || order.full_name || '—'}</p>
            <p className="text-soft">
              {[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || '—'}
            </p>
            <p className="nums mt-1 text-soft">{order.phone} · {order.email}</p>
          </section>

          <section className="mb-7">
            <h3 className="label">Items</h3>
            <div className="border border-line">
              {(detail?.items || []).map((i) => (
                <div key={i.id} className="flex items-center gap-3 border-b border-line p-3 last:border-0">
                  {i.image_url && <img src={i.image_url} alt="" className="h-11 w-11 object-cover" />}
                  <span className="flex-1 text-[0.92rem]">
                    {i.product_name}
                    <span className="nums block text-micro text-soft">{i.variant_label} × {i.quantity}</span>
                  </span>
                  <span className="nums text-[0.92rem]">{inr(i.line_total)}</span>
                </div>
              ))}
              {!detail && <p className="p-4 text-soft">Loading items…</p>}
            </div>
          </section>

          <section className="mb-7">
            <h3 className="label">Money</h3>
            <dl className="nums grid gap-1.5 text-[0.92rem]">
              <Row k="Subtotal" v={inr(detail?.subtotal ?? order.subtotal)} />
              {Number(order.coupon_discount) > 0 && <Row k={`Coupon ${order.coupon_code || ''}`} v={`−${inr(order.coupon_discount)}`} />}
              {Number(order.referral_discount) > 0 && <Row k="Referral discount" v={`−${inr(order.referral_discount)}`} />}
              {Number(order.coins_redeemed) > 0 && (
                <Row k={`Coins (${num(order.coins_redeemed)})`} v={`−${inr(order.coins_value)}`} />
              )}
              <Row k="Delivery" v={inr(order.shipping_fee)} />
              <Row k="Tax" v={inr(order.tax)} />
              <div className="mt-1 flex justify-between border-t border-line pt-2 font-display text-[1.15rem]">
                <dt>Total</dt>
                <dd>{inr(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-5">
            <div>
              <label className="label" htmlFor="st">Order status</label>
              <select id="st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ps">Payment</label>
              <select id="ps" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} className="field">
                {['unpaid', 'paid', 'failed', 'refunded', 'partially_refunded'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tn">Tracking number</label>
              <input id="tn" value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} className="field" />
            </div>

            {willReward && (
              <p className="border-l-2 border-gold bg-gold/[0.06] px-4 py-3 text-tiny">
                Marking this paid will credit the referrer who sent this customer, unless the
                referral was flagged for review.
              </p>
            )}
          </section>
        </div>

        <footer className="flex gap-3 border-t border-line px-6 py-4">
          <button onClick={save} disabled={busy} className="btn btn-solid px-6 py-2.5 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="btn btn-ghost px-6 py-2.5">Cancel</button>
        </footer>
      </aside>
    </>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <dt className="text-soft">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
