import { useEffect, useMemo, useState } from 'react'
import { adminApi } from './adminApi'
import { PageHead, Toast } from './AdminShell'
import { inr } from '../lib/format'

/**
 * Settings.
 *
 * Every control here is generated from the admin_settings rows, including
 * its label, help text and input type. Adding a tunable is a database
 * insert, not a frontend change — which is what keeps the referral
 * economics genuinely editable rather than nominally editable.
 */

const GROUP_ORDER = ['referral', 'wallet', 'store', 'seo', 'general']

const GROUP_META = {
  referral: {
    title: 'Referral programme',
    blurb:
      'What a referred customer saves, and what the referrer earns for it. Changes apply to new referrals only — anyone already promised a reward keeps the terms they signed up under.',
  },
  wallet: {
    title: 'Wallet and coins',
    blurb: 'What points are called, what they are worth, and how much of an order they can cover.',
  },
  store: { title: 'Shop', blurb: 'Contact details, delivery charges, tax and payment methods.' },
  seo: { title: 'Search and AI', blurb: 'How the shop presents itself to search engines and answer engines.' },
  general: { title: 'Other', blurb: '' },
}

export default function Settings() {
  const [groups, setGroups] = useState(null)
  const [draft, setDraft] = useState({})
  const [tab, setTab] = useState('referral')
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminApi
      .settings()
      .then((g) => {
        setGroups(g)
        if (!g[tab]) setTab(Object.keys(g)[0])
      })
      .catch((e) => setToast({ text: e.message, tone: 'error' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty = Object.keys(draft).length > 0

  const save = async () => {
    setBusy(true)
    try {
      await adminApi.saveSettings(draft)
      setGroups((g) => {
        const next = { ...g }
        Object.entries(next).forEach(([key, rows]) => {
          next[key] = rows.map((r) => (r.key in draft ? { ...r, value: draft[r.key] } : r))
        })
        return next
      })
      setDraft({})
      setToast({ text: 'Settings saved. The storefront picks them up within a few seconds.' })
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (!groups) return <><PageHead title="Settings" /><p className="p-9 text-soft">Loading…</p></>

  const tabs = GROUP_ORDER.filter((g) => groups[g]).concat(
    Object.keys(groups).filter((g) => !GROUP_ORDER.includes(g))
  )
  const rows = groups[tab] || []
  const meta = GROUP_META[tab] || { title: tab, blurb: '' }

  return (
    <>
      <PageHead title="Settings" sub="Everything the shop runs on, without touching code.">
        {dirty && (
          <>
            <button onClick={() => setDraft({})} className="btn btn-ghost px-5 py-2.5 text-tiny">
              Discard
            </button>
            <button onClick={save} disabled={busy} className="btn btn-solid px-5 py-2.5 text-tiny disabled:opacity-50">
              {busy ? 'Saving…' : `Save ${Object.keys(draft).length} change${Object.keys(draft).length === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </PageHead>

      <div className="border-b border-line px-6 lg:px-9">
        <div className="flex gap-7 overflow-x-auto">
          {tabs.map((g) => (
            <button
              key={g}
              onClick={() => setTab(g)}
              className={`whitespace-nowrap border-b-2 py-3.5 text-[0.92rem] transition-colors ${
                tab === g ? 'border-gold text-gold' : 'border-transparent text-soft hover:text-ink'
              }`}
            >
              {(GROUP_META[g] || {}).title || g}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 lg:p-9">
        {meta.blurb && <p className="mb-8 max-w-[70ch] text-soft">{meta.blurb}</p>}

        {tab === 'referral' && <ReferralPreview rows={rows} draft={draft} groups={groups} />}
        {tab === 'wallet' && <WalletPreview rows={rows} draft={draft} />}

        <div className="grid max-w-[760px] gap-7">
          {rows.map((row) => (
            <Setting
              key={row.key}
              row={row}
              value={row.key in draft ? draft[row.key] : row.value}
              changed={row.key in draft}
              onChange={(v) =>
                setDraft((d) => {
                  const next = { ...d }
                  if (JSON.stringify(v) === JSON.stringify(row.value)) delete next[row.key]
                  else next[row.key] = v
                  return next
                })
              }
            />
          ))}
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-line bg-paper/95 px-6 py-4 backdrop-blur lg:px-9">
          <p className="mr-auto text-tiny text-soft">
            {Object.keys(draft).length} unsaved change{Object.keys(draft).length === 1 ? '' : 's'}
          </p>
          <button onClick={() => setDraft({})} className="btn btn-ghost px-5 py-2.5 text-tiny">
            Discard
          </button>
          <button onClick={save} disabled={busy} className="btn btn-solid px-5 py-2.5 text-tiny disabled:opacity-50">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {toast && (
        <Toast tone={toast.tone} onDone={() => setToast(null)}>
          {toast.text}
        </Toast>
      )}
    </>
  )
}

/* A worked example, so nobody has to imagine what the numbers do. */
function ReferralPreview({ rows, draft, groups }) {
  const v = (key, dflt) => {
    if (key in draft) return draft[key]
    const all = [...(rows || []), ...(groups.wallet || [])]
    const row = all.find((r) => r.key === key)
    return row ? row.value : dflt
  }

  const type = v('referral.referee_discount_type', 'percent')
  const value = Number(v('referral.referee_discount_value', 0))
  const cap = Number(v('referral.referee_discount_max', 0))
  const points = Number(v('referral.referrer_points', 0))
  const welcome = Number(v('referral.referee_welcome_points', 0))
  const rate = Number(v('wallet.coins_per_rupee', 10)) || 10
  const coinName = v('wallet.coin_name', 'Coins')

  const basket = 1499
  const discount = type === 'percent'
    ? Math.min(basket * (value / 100), cap > 0 ? cap : Infinity)
    : value

  return (
    <div className="mb-9 max-w-[760px] border border-line bg-surface p-6">
      <h2 className="font-display text-[1.15rem]">On a {inr(basket)} order, right now</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Line label="Your friend pays" value={inr(basket - discount)} sub={`${inr(discount)} off`} />
        <Line label="They also get" value={`${welcome.toLocaleString('en-IN')} ${coinName}`} sub={`worth ${inr(welcome / rate)}`} />
        <Line label="You earn" value={`${points.toLocaleString('en-IN')} ${coinName}`} sub={`worth ${inr(points / rate)}`} />
      </div>
      <p className="mt-4 text-tiny text-soft">
        Total cost to the shop on this order: {inr(discount + points / rate + welcome / rate)}.
      </p>
    </div>
  )
}

function WalletPreview({ rows, draft }) {
  const v = (key, dflt) => {
    if (key in draft) return draft[key]
    const row = (rows || []).find((r) => r.key === key)
    return row ? row.value : dflt
  }
  const rate = Number(v('wallet.coins_per_rupee', 10)) || 10
  const name = v('wallet.coin_name', 'Coins')
  const maxPct = Number(v('wallet.max_redeem_percent', 25))

  return (
    <div className="mb-9 max-w-[760px] border border-line bg-surface p-6">
      <h2 className="font-display text-[1.15rem]">What that means to a customer</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Line label={`1,000 ${name}`} value={inr(1000 / rate)} sub="off an order" />
        <Line label={`5,000 ${name}`} value={inr(5000 / rate)} sub="off an order" />
        <Line label={`Most they can use on ${inr(1499)}`} value={inr(1499 * (maxPct / 100))} sub={`${maxPct}% of the order`} />
      </div>
    </div>
  )
}

function Line({ label, value, sub }) {
  return (
    <div>
      <p className="text-tiny text-soft">{label}</p>
      <p className="nums mt-0.5 font-display text-[1.5rem] leading-none">{value}</p>
      <p className="mt-1 text-micro text-soft">{sub}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function Setting({ row, value, changed, onChange }) {
  const id = `s-${row.key}`
  const control = row.ui_control

  const wrapper = (children) => (
    <div className={changed ? 'border-l-2 border-gold pl-4' : 'border-l-2 border-transparent pl-4'}>
      {children}
      {row.description && <p className="mt-1.5 max-w-[62ch] text-tiny text-soft">{row.description}</p>}
    </div>
  )

  if (control === 'toggle')
    return wrapper(
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(!value)}
          className={`mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
            value ? 'border-gold bg-gold' : 'border-line bg-surface'
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-paper transition-transform ${
              value ? 'translate-x-[22px]' : 'translate-x-[2px]'
            }`}
          />
        </button>
        <span className="text-[0.98rem]">{row.label}</span>
      </div>
    )

  if (control === 'select')
    return wrapper(
      <>
        <label className="label" htmlFor={id}>{row.label}</label>
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="field max-w-[340px]"
        >
          {(row.options || []).map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
          ))}
        </select>
      </>
    )

  if (control === 'textarea')
    return wrapper(
      <>
        <label className="label" htmlFor={id}>{row.label}</label>
        <textarea
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="field"
        />
      </>
    )

  if (control === 'json')
    return wrapper(
      <>
        <label className="label" htmlFor={id}>{row.label}</label>
        <textarea
          id={id}
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value))
            } catch {
              onChange(e.target.value)
            }
          }}
          rows={5}
          className="field font-mono text-tiny"
        />
      </>
    )

  if (control === 'number')
    return wrapper(
      <>
        <label className="label" htmlFor={id}>{row.label}</label>
        <input
          id={id}
          type="number"
          value={value ?? ''}
          min={row.min_value ?? undefined}
          max={row.max_value ?? undefined}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="field nums max-w-[200px]"
        />
      </>
    )

  return wrapper(
    <>
      <label className="label" htmlFor={id}>{row.label}</label>
      <input
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="field max-w-[480px]"
      />
    </>
  )
}
