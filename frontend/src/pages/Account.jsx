import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Seo from '../components/Seo'
import { api } from '../lib/api'
import { useAuth, useSettings } from '../context/StoreProvider'
import { inr, num } from '../lib/format'

const TABS = ['Orders', 'Wallet', 'Referrals', 'Details']

export default function Account() {
  const { user, ready, logout } = useAuth()
  const { get } = useSettings()
  const location = useLocation()
  const [tab, setTab] = useState('Orders')
  const [orders, setOrders] = useState([])
  const [wallet, setWallet] = useState(null)
  const [ledger, setLedger] = useState([])
  const [referrals, setReferrals] = useState(null)

  const coinName = get('wallet.coin_name', 'ZION Coins')
  const welcome = location.state?.welcome

  useEffect(() => {
    if (!user) return
    api.myOrders().then((r) => setOrders(r || [])).catch(() => setOrders([]))
    api.wallet().then(setWallet).catch(() => setWallet(null))
    api.walletHistory().then((r) => setLedger(r || [])).catch(() => setLedger([]))
    api.myReferrals().then(setReferrals).catch(() => setReferrals(null))
  }, [user])

  if (!ready) return <div className="shell py-24 text-soft">Loading your account…</div>
  if (!user) return <Navigate to="/signin?next=/account" replace />

  return (
    <>
      <Seo title="Your account — ZION Herbs" noindex />

      <header className="border-b border-line">
        <div className="shell flex flex-wrap items-end justify-between gap-6 py-14">
          <div>
            <p className="script mb-1">Your account</p>
            <h1 className="text-d2">{user.full_name || 'Welcome'}</h1>
            <p className="mt-2 text-soft">{user.email}</p>
          </div>
          <button onClick={logout} className="btn btn-ghost">
            Sign out
          </button>
        </div>
      </header>

      {welcome > 0 && (
        <div className="border-b border-line bg-surface">
          <div className="shell py-4 text-[0.95rem]">
            <span className="text-gold">{num(welcome)} {coinName}</span> added to your wallet for
            joining through a friend.
          </div>
        </div>
      )}

      <nav className="border-b border-line">
        <div className="shell flex gap-7 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 py-4 text-[0.95rem] transition-colors ${
                tab === t ? 'border-gold text-gold' : 'border-transparent text-soft hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <section className="py-12">
        <div className="shell">
          {tab === 'Orders' && <Orders orders={orders} />}
          {tab === 'Wallet' && <Wallet wallet={wallet} ledger={ledger} coinName={coinName} />}
          {tab === 'Referrals' && <Referrals stats={referrals} coinName={coinName} />}
          {tab === 'Details' && <Details user={user} />}
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ */
function Orders({ orders }) {
  if (!orders.length)
    return (
      <Empty
        title="No orders yet"
        body="When you place one it will show here, with its tracking number."
        cta={['Browse the teas', '/shop']}
      />
    )

  return (
    <div className="grid gap-px border border-line bg-line">
      {orders.map((o) => (
        <article key={o.id} className="bg-paper p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="nums font-display text-[1.15rem]">{o.order_number}</h2>
              <p className="nums mt-0.5 text-tiny text-soft">
                {new Date(o.placed_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
                {' · '}
                {o.items?.length || 0} item{(o.items?.length || 0) === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-right">
              <p className="nums font-display text-[1.3rem]">{inr(o.total)}</p>
              <Status status={o.status} paid={o.payment_status} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {(o.items || []).map((i, idx) => (
              <span key={idx} className="flex items-center gap-2 border border-line p-1.5 pr-3">
                {i.image && <img src={i.image} alt="" className="h-9 w-9 object-cover" />}
                <span className="text-tiny">
                  {i.name}
                  <span className="nums block text-micro text-soft">
                    {i.label} × {i.quantity}
                  </span>
                </span>
              </span>
            ))}
          </div>

          {o.tracking_number && (
            <p className="nums mt-4 border-t border-line pt-3 text-tiny text-soft">
              Tracking: <span className="text-ink">{o.tracking_number}</span>
            </p>
          )}
        </article>
      ))}
    </div>
  )
}

function Wallet({ wallet, ledger, coinName }) {
  if (!wallet) return <Empty title="Wallet unavailable" body="We could not load your balance. Refresh and try again." />

  return (
    <>
      <div className="grid border-l border-t border-line sm:grid-cols-3">
        {[
          [`${coinName} balance`, num(wallet.balance), `worth ${inr(wallet.value)}`],
          ['Earned all time', num(wallet.lifetime_earned), 'coins'],
          ['Spent all time', num(wallet.lifetime_spent), 'coins'],
        ].map(([label, value, sub]) => (
          <div key={label} className="border-b border-r border-line p-7">
            <p className="text-tiny text-soft">{label}</p>
            <p className="nums mt-1 font-display text-[2.2rem]">{value}</p>
            <p className="text-micro text-soft">{sub}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 max-w-[62ch] text-tiny text-soft">
        {wallet.coins_per_rupee} coins is ₹1. You can spend up to {wallet.max_redeem_percent}% of an
        order in coins, with a minimum of {num(wallet.min_redeem_points)} per redemption. Coins are
        applied at checkout.
      </p>

      <h2 className="mb-4 mt-10 text-d3">Activity</h2>
      {!ledger.length ? (
        <p className="border border-line p-8 text-soft">
          Nothing yet. Refer a friend and your first coins land here.
        </p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[560px] text-left text-[0.92rem]">
            <thead className="border-b border-line bg-surface text-tiny uppercase tracking-wide text-soft">
              <tr>
                <th className="px-5 py-3 font-normal">What happened</th>
                <th className="px-5 py-3 font-normal">Date</th>
                <th className="px-5 py-3 text-right font-normal">Coins</th>
                <th className="px-5 py-3 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody className="nums">
              {ledger.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5">
                    <span className="block">{LEDGER_LABEL[t.type] || t.type}</span>
                    {t.note && <span className="block text-tiny text-soft">{t.note}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-soft">
                    {new Date(t.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: '2-digit',
                    })}
                  </td>
                  <td className={`px-5 py-3.5 text-right ${t.points > 0 ? 'text-[#4A7239]' : 'text-ink'}`}>
                    {t.points > 0 ? '+' : ''}
                    {num(t.points)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-soft">{num(t.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

const LEDGER_LABEL = {
  referral_reward: 'Referral reward',
  welcome_bonus: 'Welcome bonus',
  signup_bonus: 'Signup bonus',
  redeem: 'Spent at checkout',
  redeem_refund: 'Coins returned',
  reversal: 'Reward reversed',
  admin_credit: 'Added by ZION',
  admin_debit: 'Adjusted by ZION',
  review_reward: 'Thanks for the review',
  promo: 'Promotion',
}

function Referrals({ stats, coinName }) {
  if (!stats) return <Empty title="Referrals unavailable" body="Refresh and try again." />

  return (
    <>
      <div className="border border-line p-7">
        <span className="label">Your link</span>
        <div className="flex flex-wrap items-center gap-3">
          <code className="flex-1 overflow-x-auto whitespace-nowrap border border-line bg-surface px-4 py-3 font-body text-[0.95rem]">
            {stats.link}
          </code>
          <button
            onClick={() => navigator.clipboard?.writeText(stats.link)}
            className="btn btn-gold shrink-0"
          >
            Copy
          </button>
        </div>
      </div>

      <dl className="mt-px grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Link opened', stats.clicks],
          ['Friends joined', stats.signups],
          ['Orders placed', stats.conversions],
          [`${coinName} earned`, stats.points_earned],
        ].map(([label, value]) => (
          <div key={label} className="border-b border-r border-line p-7">
            <dt className="text-tiny text-soft">{label}</dt>
            <dd className="nums mt-1 font-display text-[2rem]">{num(value)}</dd>
          </div>
        ))}
      </dl>

      <Link to="/refer" className="mt-7 inline-block border-b border-gold pb-0.5 text-gold">
        Share it and see how it works
      </Link>
    </>
  )
}

function Details({ user }) {
  const [form, setForm] = useState({ full_name: user.full_name || '', phone: user.phone || '' })
  const [state, setState] = useState('idle')

  const save = async (e) => {
    e.preventDefault()
    setState('saving')
    try {
      await api.updateProfile(form)
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <form onSubmit={save} className="max-w-[440px] grid gap-5">
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input
          id="name"
          className="field"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="ph">Phone</label>
        <input
          id="ph"
          className="field"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="em">Email</label>
        <input id="em" className="field opacity-60" value={user.email} disabled />
        <p className="mt-1.5 text-tiny text-soft">
          Email cannot be changed here. Message us if you need it moved.
        </p>
      </div>

      <button disabled={state === 'saving'} className="btn btn-solid w-full disabled:opacity-50">
        {state === 'saving' ? 'Saving…' : 'Save changes'}
      </button>
      {state === 'saved' && <p className="text-tiny text-gold">Saved.</p>}
      {state === 'error' && (
        <p className="text-tiny text-[#8F3623]">That did not save. Check the fields and try again.</p>
      )}
    </form>
  )
}

function Status({ status, paid }) {
  const map = {
    pending: 'border-line text-soft',
    confirmed: 'border-gold text-gold',
    packed: 'border-gold text-gold',
    shipped: 'border-gold text-gold',
    delivered: 'border-[#5C8A4A] text-[#4A7239]',
    cancelled: 'border-[#B4472F] text-[#8F3623]',
    refunded: 'border-[#B4472F] text-[#8F3623]',
  }
  return (
    <span className="mt-1.5 flex items-center justify-end gap-2">
      <span className={`border px-2.5 py-0.5 text-micro uppercase ${map[status] || map.pending}`}>
        {status}
      </span>
      {paid === 'paid' && <span className="text-micro uppercase text-[#4A7239]">paid</span>}
    </span>
  )
}

function Empty({ title, body, cta }) {
  return (
    <div className="border border-line py-16 text-center">
      <p className="script mb-2">{title}</p>
      <p className="mx-auto max-w-[42ch] text-soft">{body}</p>
      {cta && (
        <Link to={cta[1]} className="btn btn-solid mt-6">
          {cta[0]}
        </Link>
      )}
    </div>
  )
}
