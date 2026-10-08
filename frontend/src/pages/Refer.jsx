import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import { canonical } from '../lib/site'
import { api } from '../lib/api'
import { useAuth, useSettings } from '../context/StoreProvider'
import { num } from '../lib/format'

export default function Refer() {
  const { user } = useAuth()
  const { get } = useSettings()
  const [stats, setStats] = useState(null)
  const [copied, setCopied] = useState(false)

  const coinName = get('wallet.coin_name', 'ZION Coins')
  const rate = Number(get('wallet.coins_per_rupee', 10))

  useEffect(() => {
    if (!user) return
    api.myReferrals().then(setStats).catch(() => setStats(null))
  }, [user])

  const link = stats?.link || (user ? `${window.location.origin}/r/${user.referral_code}` : '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  const share = (channel) => {
    const msg = (stats?.share_message || 'I have been drinking ZION herbal teas. Use my link:')
      .replace('{discount}', stats?.discount_label || 'a discount')
      .replace('{code}', user?.referral_code || '')
      .replace('{name}', user?.full_name || '')
    const text = encodeURIComponent(`${msg} ${link}`)
    const urls = {
      whatsapp: `https://wa.me/?text=${text}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`,
      email: `mailto:?subject=${encodeURIComponent('Try ZION herbal teas')}&body=${text}`,
    }
    window.open(urls[channel], '_blank', 'noopener')
  }

  return (
    <>
      <Seo
        title={`Refer a friend, earn ${coinName} — ZION Herbs`}
        description={`Share your ZION link. Your friend saves on their first order and you earn ${coinName} that come off your next one.`}
        canonical={canonical('/refer')}
      />

      <header className="border-b border-line">
        <div className="shell py-16">
          <p className="script mb-1">Refer and earn</p>
          <h1 className="max-w-[20ch] text-d1">Send a friend a pot, keep the coins</h1>
          <p className="mt-5 max-w-[54ch] text-lede text-soft">
            Every account gets its own link. Your friend saves on their first order, and you collect{' '}
            {coinName} that come straight off your next one — {rate} coins to ₹1.
          </p>
        </div>
      </header>

      {/* the link, or the reason there isn't one yet */}
      <section className="py-14">
        <div className="shell">
          {!user ? (
            <div className="border border-line bg-surface p-10 text-center">
              <p className="script mb-2">Your link is one step away</p>
              <p className="mx-auto max-w-[42ch] text-soft">
                Every account has its own referral link. Sign in and yours is already there.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to="/signin" className="btn btn-solid">Sign in</Link>
              </div>
              <p className="mx-auto mt-4 max-w-[40ch] text-tiny text-soft">
                No account? We set them up by hand — ask us and we will sort it out.
              </p>
            </div>
          ) : (
            <>
              <div className="border border-line p-8">
                <span className="label">Your referral link</span>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap border border-line bg-surface px-4 py-3.5 font-body text-[0.95rem]">
                    {link || 'Loading…'}
                  </code>
                  <button onClick={copy} className="btn btn-gold shrink-0">
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="text-tiny text-soft">Share on</span>
                  {['whatsapp', 'telegram', 'email'].map((c) => (
                    <button
                      key={c}
                      onClick={() => share(c)}
                      className="border border-line px-4 py-2 text-tiny capitalize text-soft transition-colors hover:border-gold hover:text-gold"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <dl className="mt-px grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Link opened', stats?.clicks, 'times'],
                  ['Friends joined', stats?.signups, 'accounts'],
                  ['Orders placed', stats?.conversions, 'qualified'],
                  [`${coinName} earned`, stats?.points_earned, 'total'],
                ].map(([label, value, sub]) => (
                  <div key={label} className="border-b border-r border-line bg-paper p-7">
                    <dt className="text-tiny text-soft">{label}</dt>
                    <dd className="nums mt-1 font-display text-[2.1rem]">{num(value || 0)}</dd>
                    <p className="text-micro uppercase text-soft">{sub}</p>
                  </div>
                ))}
              </dl>

              {stats?.referrals?.length > 0 && (
                <div className="mt-10">
                  <h2 className="mb-4 text-d3">Who has joined</h2>
                  <div className="overflow-x-auto border border-line">
                    <table className="w-full text-left text-[0.92rem]">
                      <thead className="border-b border-line bg-surface text-tiny uppercase tracking-wide text-soft">
                        <tr>
                          <th className="px-5 py-3 font-normal">Friend</th>
                          <th className="px-5 py-3 font-normal">Joined</th>
                          <th className="px-5 py-3 font-normal">Status</th>
                          <th className="px-5 py-3 text-right font-normal">Earned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.referrals.map((r) => (
                          <tr key={r.id} className="border-b border-line last:border-0">
                            <td className="px-5 py-3.5">{r.full_name || 'A friend'}</td>
                            <td className="nums px-5 py-3.5 text-soft">
                              {new Date(r.joined_at).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusPill status={r.status} />
                            </td>
                            <td className="nums px-5 py-3.5 text-right">
                              {r.referrer_points_awarded ? num(r.referrer_points_awarded) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* how it works — a real sequence, so it is numbered */}
      <section className="border-y border-line bg-surface py-20">
        <div className="shell">
          <h2 className="mb-10 text-d2">How it works</h2>
          <ol className="grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Share your link', 'It is in your account from the moment you register. Every click is counted.'],
              ['Your friend registers', 'The link is remembered for 30 days, so they can think about it.'],
              ['They order and save', `Their first order gets ${stats?.discount_label || 'a discount'}, applied automatically at checkout.`],
              [`You collect ${coinName}`, `Credited once their order is paid. Spend them at ${rate} coins to ₹1.`],
            ].map(([title, body], i) => (
              <li key={title}>
                <span className="nums font-display text-[1.1rem] text-gold">0{i + 1}</span>
                <h3 className="mt-2 text-[1.08rem]">{title}</h3>
                <p className="mt-1.5 text-soft">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 max-w-[70ch] border-t border-line pt-6 text-tiny text-soft">
            <p className="mb-2 text-ink">The fine print, in plain words</p>
            <p>
              One reward per friend, on their first paid order only. You cannot refer yourself —
              accounts sharing an email, phone, device or network are held for review. If an order
              is refunded, the coins for it are taken back. Coins expire after a year of no
              activity, and the shop can change the rates at any time; changes never alter a reward
              you have already earned.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

function StatusPill({ status }) {
  const map = {
    pending: ['Waiting on first order', 'border-line text-soft'],
    qualified: ['Order placed', 'border-gold text-gold'],
    rewarded: ['Coins paid', 'border-[#5C8A4A] text-[#4A7239]'],
    rejected: ['Not eligible', 'border-line text-soft'],
    reversed: ['Reversed', 'border-[#B4472F] text-[#B4472F]'],
  }
  const [label, cls] = map[status] || map.pending
  return <span className={`inline-block border px-2.5 py-1 text-micro uppercase ${cls}`}>{label}</span>
}
