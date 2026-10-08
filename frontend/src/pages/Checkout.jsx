import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo'
import { api } from '../lib/api'
import { payWithRazorpay } from '../lib/razorpay'
import { useAuth, useCart, useSettings } from '../context/StoreProvider'
import { inr, num } from '../lib/format'
import Img from '../components/Img'

const BLANK_ADDRESS = {
  full_name: '', phone: '', line1: '', line2: '',
  city: '', state: 'Tamil Nadu', pincode: '', country: 'India',
}

export default function Checkout() {
  const { lines, subtotal, clear } = useCart()
  const { user } = useAuth()
  const { get } = useSettings()
  const navigate = useNavigate()

  const [address, setAddress] = useState(BLANK_ADDRESS)
  const [email, setEmail] = useState('')
  const [method, setMethod] = useState('cod')
  const [coupon, setCoupon] = useState('')
  const [useCoins, setUseCoins] = useState(true)
  const [quote, setQuote] = useState(null)
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [placed, setPlaced] = useState(null)
  const [methods, setMethods] = useState(null)
  const [payNotice, setPayNotice] = useState(null)

  const coinName = get('wallet.coin_name', 'ZION Coins')
  const whatsapp = get('store.whatsapp', '916384013131')

  // The server decides which methods are live: a method needs both the
  // admin toggle and, for cards, real keys in the environment.
  useEffect(() => {
    api
      .paymentMethods({ cod: true, razorpay: false, whatsapp: true })
      .then((m) => {
        setMethods(m)
        if (!m[method]) setMethod(m.cod ? 'cod' : m.razorpay ? 'razorpay' : 'whatsapp')
      })
      .catch(() => setMethods({ cod: true, razorpay: false, whatsapp: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
      setAddress((a) => ({
        ...a,
        full_name: a.full_name || user.full_name || '',
        phone: a.phone || user.phone || '',
      }))
    }
  }, [user])

  // Re-price whenever anything that affects the total changes. The server
  // is the only thing that decides what an order costs.
  const reprice = useCallback(async () => {
    if (!lines.length) return setQuote(null)
    try {
      const q = await api.quote({
        items: lines.map((l) => ({ sku: l.sku, quantity: l.qty })),
        coupon_code: coupon || undefined,
        coins: useCoins ? undefined : 0,
      })
      setQuote(q)
      setProblem(null)
    } catch (e) {
      setProblem(e.message)
      setQuote(null)
    }
  }, [lines, coupon, useCoins])

  useEffect(() => {
    const t = setTimeout(reprice, 250)
    return () => clearTimeout(t)
  }, [reprice])

  const submit = async (e) => {
    e.preventDefault()
    setPlacing(true)
    setErrors({})
    setProblem(null)
    try {
      const res = await api.placeOrder({
        items: lines.map((l) => ({ sku: l.sku, quantity: l.qty })),
        shipping_address: address,
        email,
        payment_method: method,
        coupon_code: coupon || undefined,
        coins: useCoins ? undefined : 0,
      })
      // The order exists now, whatever happens next. Only clear the bag
      // once it is safely written, so a failed payment never loses it.
      if (method === 'razorpay') {
        try {
          const outcome = await payWithRazorpay({
            orderNumber: res.order_number,
            customer: { name: address.full_name, email, phone: address.phone },
          })

          if (outcome.status === 'dismissed') {
            setProblem(
              `Order ${res.order_number} is saved but not paid. ` +
                'Reopen it from your account when you are ready.'
            )
            clear()
            setPlacing(false)
            return
          }
          if (outcome.status === 'pending') setPayNotice(outcome.message)
        } catch (payErr) {
          setProblem(payErr.message)
          clear()
          setPlacing(false)
          return
        }
      }

      clear()
      setPlaced(res)
    } catch (err) {
      setErrors(err.payload?.errors || {})
      setProblem(err.message)
    } finally {
      setPlacing(false)
    }
  }

  /* ------------------------------------------------ order placed */
  if (placed)
    return (
      <>
        <Seo title="Order placed — ZION Herbs" noindex />
        <section className="shell grid min-h-[58vh] place-items-center py-20 text-center">
          <div className="max-w-[48ch]">
            <p className="script mb-2">Thank you</p>
            <h1 className="text-d2">Order {placed.order_number} is in</h1>
            {payNotice ? (
              <p className="mt-4 border-l-2 border-gold bg-gold/[0.06] px-4 py-3 text-left text-[0.95rem]">
                {payNotice}
              </p>
            ) : (
              <p className="mt-4 text-soft">
                We have emailed a receipt to {email}. You will hear from us again when it ships —
                usually within a working day.
              </p>
            )}
            <p className="nums mt-6 font-display text-[1.6rem]">{inr(placed.total)}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/account" className="btn btn-solid">Track this order</Link>
              <Link to="/shop" className="btn btn-ghost">Keep shopping</Link>
            </div>
          </div>
        </section>
      </>
    )

  /* ------------------------------------------------ empty bag */
  if (!lines.length)
    return (
      <>
        <Seo title="Your bag — ZION Herbs" noindex />
        <section className="shell grid min-h-[52vh] place-items-center py-20 text-center">
          <div className="max-w-[42ch]">
            <p className="script mb-2">Nothing brewing yet</p>
            <h1 className="text-d3">Your bag is empty</h1>
            <p className="mt-3 text-soft">
              Six caffeine-free infusions, or the discovery box if you cannot choose.
            </p>
            <Link to="/shop" className="btn btn-solid mt-7">Browse the teas</Link>
          </div>
        </section>
      </>
    )

  return (
    <>
      <Seo title="Checkout — ZION Herbs" noindex />

      <header className="border-b border-line">
        <div className="shell py-12">
          <p className="script mb-1">Almost there</p>
          <h1 className="text-d2">Checkout</h1>
        </div>
      </header>

      <section className="shell grid gap-14 py-12 lg:grid-cols-[1.1fr_.9fr]">
        {/* ------------------------------------------------ the form */}
        <form onSubmit={submit} noValidate>
          {problem && (
            <p role="alert" className="mb-7 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.05] px-4 py-3 text-[0.92rem] text-[#8F3623]">
              {problem}
            </p>
          )}

          {!user && (
            <div className="mb-8 border border-line bg-surface px-5 py-4">
              <p className="text-[0.95rem]">
                <Link to="/signin?next=/checkout" className="text-gold underline underline-offset-4">
                  Sign in
                </Link>{' '}
                to use your {coinName} and any referral discount.
              </p>
            </div>
          )}

          <h2 className="mb-5 text-d3">Where should it go?</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <F id="full_name" label="Full name" value={address.full_name} err={errors.full_name}
               onChange={(v) => setAddress({ ...address, full_name: v })} className="sm:col-span-2" />
            <F id="email" label="Email" type="email" value={email} err={errors.email}
               onChange={setEmail} hint="For the receipt and shipping updates." />
            <F id="phone" label="Phone" type="tel" value={address.phone} err={errors.phone}
               onChange={(v) => setAddress({ ...address, phone: v })} />
            <F id="line1" label="Address" value={address.line1} err={errors.line1}
               onChange={(v) => setAddress({ ...address, line1: v })} className="sm:col-span-2" />
            <F id="line2" label="Apartment, landmark" value={address.line2} optional
               onChange={(v) => setAddress({ ...address, line2: v })} className="sm:col-span-2" />
            <F id="city" label="City" value={address.city} err={errors.city}
               onChange={(v) => setAddress({ ...address, city: v })} />
            <F id="state" label="State" value={address.state} err={errors.state}
               onChange={(v) => setAddress({ ...address, state: v })} />
            <F id="pincode" label="Pincode" value={address.pincode} err={errors.pincode}
               onChange={(v) => setAddress({ ...address, pincode: v })} />
          </div>

          <h2 className="mb-5 mt-10 text-d3">How would you like to pay?</h2>
          <div className="grid gap-2">
            {[
              ['cod', 'Cash on delivery', 'Pay the courier when it arrives.'],
              ['razorpay', 'Card, UPI or netbanking', 'Secure payment through Razorpay.'],
              ['whatsapp', 'Arrange it on WhatsApp', 'We confirm the order and payment with you directly.'],
            ]
              .filter(([key]) => !methods || methods[key])
              .map(([key, label, hint]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${
                  method === key ? 'border-gold bg-gold/[0.04]' : 'border-line hover:border-gold/50'
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  checked={method === key}
                  onChange={() => setMethod(key)}
                  className="mt-1 accent-[rgb(var(--c-gold))]"
                />
                <span>
                  <span className="block text-[0.98rem]">{label}</span>
                  <span className="block text-tiny text-soft">{hint}</span>
                </span>
              </label>
              ))}
          </div>

          <button
            disabled={placing || !quote}
            className="btn btn-solid mt-8 w-full disabled:opacity-50"
          >
            {placing
              ? method === 'razorpay'
                ? 'Opening payment…'
                : 'Placing your order…'
              : quote
              ? `${method === 'razorpay' ? 'Pay' : 'Place order'} · ${inr(quote.total)}`
              : 'Place order'}
          </button>

          <p className="mt-4 text-center text-tiny text-soft">
            Prefer to talk?{' '}
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline underline-offset-4"
            >
              Order on WhatsApp instead
            </a>
          </p>
        </form>

        {/* ------------------------------------------------ summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-line">
            <h2 className="border-b border-line px-6 py-4 font-display text-[1.2rem]">
              Your order
            </h2>

            <div className="px-6">
              {lines.map((l) => (
                <div key={l.sku} className="flex gap-4 border-b border-line py-4 last:border-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden bg-surface"
                       style={{ borderLeft: `2px solid ${l.accent || '#8F7222'}` }}>
                    <Img src={l.image} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[0.95rem]">{l.name}</p>
                    <p className="nums text-tiny text-soft">{l.label} × {l.qty}</p>
                  </div>
                  <p className="nums">{inr(l.price * l.qty)}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-line px-6 py-5">
              <label className="label" htmlFor="coupon">Coupon</label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Have a code?"
                  className="field py-2.5"
                />
                <button type="button" onClick={reprice} className="btn btn-ghost shrink-0 px-4 py-2.5 text-tiny">
                  Apply
                </button>
              </div>
              {quote?.coupon_note && (
                <p className="mt-2 text-tiny text-[#8F3623]">{quote.coupon_note}</p>
              )}
              {quote?.coupon_code && (
                <p className="mt-2 text-tiny text-gold">{quote.coupon_code} applied.</p>
              )}
            </div>

            {user && quote && quote.coins_max > 0 && (
              <div className="border-t border-line px-6 py-5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={useCoins}
                    onChange={(e) => setUseCoins(e.target.checked)}
                    className="mt-1 accent-[rgb(var(--c-gold))]"
                  />
                  <span>
                    <span className="block text-[0.95rem]">
                      Use {num(quote.coins_max)} {coinName}
                    </span>
                    <span className="block text-tiny text-soft">
                      Saves {inr(quote.max_discount ?? quote.coins_value)} · you have{' '}
                      {num(quote.coins_balance)}
                    </span>
                  </span>
                </label>
              </div>
            )}

            {user && quote?.coins_note && quote.coins_max === 0 && (
              <p className="border-t border-line px-6 py-4 text-tiny text-soft">{quote.coins_note}</p>
            )}

            <dl className="nums grid gap-2 border-t border-line px-6 py-5 text-[0.95rem]">
              <Row k="Subtotal" v={inr(quote?.subtotal ?? subtotal)} />
              {quote?.coupon_discount > 0 && <Row k="Coupon" v={`−${inr(quote.coupon_discount)}`} gold />}
              {quote?.referral_discount > 0 && (
                <Row k={`Referral discount${quote.referral_label ? ` (${quote.referral_label})` : ''}`}
                     v={`−${inr(quote.referral_discount)}`} gold />
              )}
              {quote?.coins_value > 0 && (
                <Row k={`${coinName} (${num(quote.coins_redeemed)})`} v={`−${inr(quote.coins_value)}`} gold />
              )}
              <Row k="Delivery" v={quote?.shipping_fee ? inr(quote.shipping_fee) : 'Free'} />
              {quote?.tax > 0 && <Row k="GST" v={inr(quote.tax)} />}
              <div className="mt-2 flex justify-between border-t border-line pt-3 font-display text-[1.35rem]">
                <dt>Total</dt>
                <dd>{quote ? inr(quote.total) : '—'}</dd>
              </div>
            </dl>

            {quote?.referral_note && !quote.referral_discount && (
              <p className="border-t border-line px-6 py-4 text-tiny text-soft">
                {quote.referral_note}
              </p>
            )}
          </div>
        </aside>
      </section>
    </>
  )
}

function Row({ k, v, gold }) {
  return (
    <div className="flex justify-between">
      <dt className="text-soft">{k}</dt>
      <dd className={gold ? 'text-gold' : ''}>{v}</dd>
    </div>
  )
}

function F({ id, label, value, onChange, err, hint, optional, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
        {optional && <span className="normal-case tracking-normal text-soft"> — optional</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`field ${err ? 'border-[#B4472F]' : ''}`}
      />
      {err ? (
        <p className="mt-1.5 text-tiny text-[#8F3623]">{err}</p>
      ) : hint ? (
        <p className="mt-1.5 text-tiny text-soft">{hint}</p>
      ) : null}
    </div>
  )
}
