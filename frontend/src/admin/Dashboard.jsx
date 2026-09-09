import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from './adminApi'
import { PageHead, Pill } from './AdminShell'
import { inr, num } from '../lib/format'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    adminApi.dashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error)
    return (
      <>
        <PageHead title="Overview" />
        <div className="p-6 lg:p-9">
          <p className="border-l-2 border-[#B4472F] bg-[#B4472F]/[0.05] px-5 py-4 text-[#8F3623]">
            {error} — check that the API is running on port 5000.
          </p>
        </div>
      </>
    )

  if (!data) return <><PageHead title="Overview" /><p className="p-9 text-soft">Loading…</p></>

  const s = data.stats
  const peak = Math.max(1, ...data.daily.map((d) => Number(d.revenue)))

  return (
    <>
      <PageHead title="Overview" sub="The last thirty days, and anything that needs a decision today." />

      <div className="p-6 lg:p-9">
        {/* things that need attention, before the numbers */}
        {(s.pending_orders > 0 || s.referrals_flagged > 0 || s.unread_messages > 0 ||
          data.low_stock.length > 0 || s.pending_reviews > 0) && (
          <div className="mb-8 flex flex-wrap gap-2">
            {s.pending_orders > 0 && (
              <Attention to="/admin/orders?status=pending" tone="gold">
                {s.pending_orders} order{s.pending_orders === 1 ? '' : 's'} to confirm
              </Attention>
            )}
            {s.referrals_flagged > 0 && (
              <Attention to="/admin/referrals?flagged=1" tone="bad">
                {s.referrals_flagged} referral{s.referrals_flagged === 1 ? '' : 's'} held for review
              </Attention>
            )}
            {data.low_stock.length > 0 && (
              <Attention to="/admin/products" tone="bad">
                {data.low_stock.length} variant{data.low_stock.length === 1 ? '' : 's'} low on stock
              </Attention>
            )}
            {s.pending_reviews > 0 && (
              <Attention to="/admin/content" tone="neutral">
                {s.pending_reviews} review{s.pending_reviews === 1 ? '' : 's'} awaiting approval
              </Attention>
            )}
            {s.unread_messages > 0 && (
              <Attention to="/admin/content" tone="neutral">
                {s.unread_messages} unread message{s.unread_messages === 1 ? '' : 's'}
              </Attention>
            )}
          </div>
        )}

        <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Revenue, 30 days" value={inr(s.revenue_30d)} sub={`${num(s.orders_30d)} orders`} />
          <Stat label="Revenue, all time" value={inr(s.revenue_all)} sub="paid orders only" />
          <Stat label="Customers" value={num(s.customers)} sub={`+${num(s.customers_30d)} this month`} />
          <Stat
            label="Coins outstanding"
            value={num(s.coins_outstanding)}
            sub={`${inr(s.coins_liability)} liability`}
          />
        </div>

        {/* revenue, 30 days */}
        <section className="mt-9 border border-line bg-paper p-6">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[1.2rem]">Revenue, last 30 days</h2>
            <p className="nums text-tiny text-soft">peak {inr(peak)}</p>
          </div>

          {data.daily.length === 0 ? (
            <p className="py-8 text-center text-soft">No orders in the last thirty days.</p>
          ) : (
            <div className="flex h-[132px] items-end gap-[3px]" role="img"
                 aria-label={`Daily revenue for the last ${data.daily.length} days`}>
              {data.daily.map((d) => (
                <div key={d.day} className="group relative flex-1">
                  <div
                    className="w-full bg-gold-lit transition-colors group-hover:bg-gold"
                    style={{ height: `${Math.max(2, (Number(d.revenue) / peak) * 128)}px` }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden
                                   -translate-x-1/2 whitespace-nowrap border border-line bg-paper px-2 py-1
                                   text-micro group-hover:block">
                    {new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {inr(d.revenue)} · {d.orders} order{d.orders === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-9 grid gap-9 lg:grid-cols-2">
          {/* recent orders */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-[1.2rem]">Latest orders</h2>
              <Link to="/admin/orders" className="text-tiny text-gold hover:underline">All orders →</Link>
            </div>
            <div className="overflow-x-auto border border-line bg-paper">
              <table className="w-full min-w-[440px] text-left text-[0.9rem]">
                <thead className="border-b border-line bg-surface text-micro uppercase tracking-wide text-soft">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">Order</th>
                    <th className="px-4 py-2.5 font-normal">Customer</th>
                    <th className="px-4 py-2.5 text-right font-normal">Total</th>
                    <th className="px-4 py-2.5 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="nums">
                  {data.recent_orders.map((o) => (
                    <tr key={o.order_number} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">{o.order_number}</td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-soft">{o.email}</td>
                      <td className="px-4 py-3 text-right">{inr(o.total)}</td>
                      <td className="px-4 py-3">
                        <Pill tone={o.payment_status === 'paid' ? 'good' : 'neutral'}>{o.status}</Pill>
                      </td>
                    </tr>
                  ))}
                  {!data.recent_orders.length && (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-soft">No orders yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* referrers */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-[1.2rem]">Who is bringing people in</h2>
              <Link to="/admin/referrals" className="text-tiny text-gold hover:underline">Referrals →</Link>
            </div>
            <div className="overflow-x-auto border border-line bg-paper">
              <table className="w-full min-w-[440px] text-left text-[0.9rem]">
                <thead className="border-b border-line bg-surface text-micro uppercase tracking-wide text-soft">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">Customer</th>
                    <th className="px-4 py-2.5 text-right font-normal">Clicks</th>
                    <th className="px-4 py-2.5 text-right font-normal">Joined</th>
                    <th className="px-4 py-2.5 text-right font-normal">Ordered</th>
                  </tr>
                </thead>
                <tbody className="nums">
                  {data.top_referrers.map((r) => (
                    <tr key={r.referral_code} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <span className="block">{r.full_name || r.email}</span>
                        <span className="block text-micro text-soft">{r.referral_code}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-soft">{num(r.clicks)}</td>
                      <td className="px-4 py-3 text-right">{num(r.signups)}</td>
                      <td className="px-4 py-3 text-right text-gold">{num(r.conversions)}</td>
                    </tr>
                  ))}
                  {!data.top_referrers.length && (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-soft">
                      Nobody has shared a link yet.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* stock + top sellers */}
        <div className="mt-9 grid gap-9 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 font-display text-[1.2rem]">Running low</h2>
            <div className="border border-line bg-paper">
              {data.low_stock.length === 0 ? (
                <p className="px-5 py-8 text-center text-soft">Everything is well stocked.</p>
              ) : (
                data.low_stock.map((v) => (
                  <div key={v.sku} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-0">
                    <div>
                      <span className="block text-[0.92rem]">{v.name} · {v.label}</span>
                      <span className="nums block text-micro text-soft">{v.sku}</span>
                    </div>
                    <Pill tone={v.stock === 0 ? 'bad' : 'gold'}>
                      {v.stock === 0 ? 'Sold out' : `${v.stock} left`}
                    </Pill>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-[1.2rem]">Best sellers, 30 days</h2>
            <div className="border border-line bg-paper">
              {data.top_products.length === 0 ? (
                <p className="px-5 py-8 text-center text-soft">No sales in the last month.</p>
              ) : (
                data.top_products.map((p) => (
                  <div key={p.product_name} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-0">
                    <span className="text-[0.92rem]">{p.product_name}</span>
                    <span className="nums text-right text-[0.92rem]">
                      {inr(p.revenue)}
                      <span className="block text-micro text-soft">{num(p.units)} units</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="border-b border-r border-line bg-paper p-6">
      <p className="text-tiny text-soft">{label}</p>
      <p className="nums mt-1.5 font-display text-[1.85rem] leading-none">{value}</p>
      <p className="mt-1.5 text-micro text-soft">{sub}</p>
    </div>
  )
}

function Attention({ to, tone, children }) {
  const tones = {
    gold: 'border-gold bg-gold/[0.06] text-gold',
    bad: 'border-[#B4472F] bg-[#B4472F]/[0.05] text-[#8F3623]',
    neutral: 'border-line bg-paper text-soft hover:text-ink',
  }
  return (
    <Link to={to} className={`border px-4 py-2 text-[0.9rem] transition-colors ${tones[tone]}`}>
      {children}
    </Link>
  )
}
