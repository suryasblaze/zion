import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import { api } from '../lib/api'
import { TEAS } from '../data/catalog'
import { accentStyle } from '../lib/format'

/**
 * Event sampling form.
 *
 * Built for a phone held in one hand at a busy stall: three fields, big
 * targets, and a flavour grid you choose from by tapping a picture rather
 * than reading a dropdown. Everything the page says comes from settings,
 * so the copy can change between events without a deploy.
 */

const CODE_KEY = 'zion.event_code'

const FALLBACK = {
  enabled: true,
  name: 'ZION tasting',
  headline: 'Pick a tea. It is on us.',
  intro:
    'Tell us where to find you and which of the six you would like to try. Show the code on the next screen at the counter and it is yours.',
  thank_you: 'Show this code at the counter and we will pour yours.',
  closed_message: 'Sampling has finished for this event. Thank you to everyone who came by.',
  collect_email: false,
  products: TEAS.map((t) => ({
    id: t.slug,
    name: t.name,
    slug: t.slug,
    tagline: t.tagline,
    accent_color: t.accent,
    short_desc: t.short,
    botanical_name: t.botanical,
  })),
}

export default function EventSignup() {
  const [cfg, setCfg] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', product_slug: '' })
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [copied, setCopied] = useState(false)
  const liveRef = useRef(null)

  useEffect(() => {
    api
      .eventConfig(FALLBACK)
      .then((c) => {
        const conf = c?.products?.length ? c : FALLBACK
        setCfg(conf)

        // This browser keeps its own claim code. A refresh, a second tap,
        // or coming back an hour later shows it again from here -- the
        // server will not hand a code to anyone who merely knows a phone
        // number, so the device has to be the one that remembers.
        try {
          const saved = JSON.parse(localStorage.getItem(CODE_KEY) || 'null')
          if (saved && saved.event_slug === (conf.slug || 'default')) setDone(saved)
        } catch {
          /* a corrupt entry just means they fill the form again */
        }
      })
      .catch(() => setCfg(FALLBACK))
  }, [])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
    setProblem(null)
  }

  /**
   * Checked here before anything is sent. The server validates too and
   * remains the authority, but this page is used on a stall's patchy
   * signal: telling someone they forgot their number should not cost a
   * round trip that might fail anyway.
   */
  const validate = () => {
    const e = {}
    if (form.full_name.trim().length < 2) e.full_name = 'Tell us your name.'
    const digits = form.phone.replace(/\D/g, '')
    if (!digits) e.phone = 'Enter your mobile number.'
    else if (digits.length < 10) e.phone = 'That is too short — 10 digits please.'
    if (!form.product_slug) e.product_slug = 'Choose the tea you would like to try.'
    if (cfg?.collect_email && form.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(form.email))
      e.email = 'That email does not look right.'
    return e
  }

  const submit = async (e) => {
    e.preventDefault()

    const found = validate()
    if (Object.keys(found).length) {
      setErrors(found)
      setProblem(null)
      document.getElementById(Object.keys(found)[0])?.focus()
      return
    }

    setBusy(true)
    setErrors({})
    setProblem(null)
    try {
      const res = await api.eventSignup({
        ...form,
        email: cfg?.collect_email ? form.email : undefined,
        source: new URLSearchParams(window.location.search).get('src') || 'link',
      })
      setDone(res)
      try {
        localStorage.setItem(
          CODE_KEY,
          JSON.stringify({ ...res, event_slug: cfg?.slug || 'default' })
        )
      } catch {
        /* private browsing: they still have the code on screen */
      }
    } catch (err) {
      const fieldErrors = err.payload?.errors
      setErrors(fieldErrors || {})
      setProblem(
        fieldErrors
          ? err.message
          : err.status === 403 || err.status === 409
          ? err.message
          : 'We could not reach the counter just now. Check your signal and try again — ' +
            'nothing has been sent twice.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (!cfg) {
    return (
      <section className="shell grid min-h-[60vh] place-items-center py-20">
        <p className="text-soft">Loading…</p>
      </section>
    )
  }

  /* ---------------------------------------------------- thank you */
  if (done) {
    const chosen = cfg.products.find((p) => p.name === done.product_name)
    return (
      <>
        <Seo title={`You are on the list — ${cfg.name}`} noindex />
        <section
          style={chosen ? { '--c-accent': hexToRgb(chosen.accent_color) } : undefined}
          className="shell grid min-h-[72vh] place-items-center py-14"
        >
          <div className="w-full max-w-[30rem] text-center">
            <p className="script mb-1">Thank you</p>
            <h1 className="text-d2">
              {done.already_registered ? 'You are already on the list' : 'You are on the list'}
            </h1>
            <p className="mx-auto mt-3 max-w-[34ch] text-soft">{done.thank_you || cfg.thank_you}</p>

            <div className="mt-8 border border-line bg-surface p-7">
              <p className="label mb-1">Your code</p>
              <p className="nums font-display text-[2.6rem] leading-none tracking-[0.12em]">
                {done.claim_code}
              </p>

              <p className="mt-5 border-t border-line pt-4 text-soft">
                <span className="block text-tiny">You chose</span>
                <span className="font-display text-[1.3rem] text-ink">{done.product_name}</span>
              </p>

              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(done.claim_code)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    setCopied(false)
                  }
                }}
                className="btn btn-ghost mt-5 w-full"
              >
                {copied ? 'Copied' : 'Copy the code'}
              </button>
            </div>

            <p className="mt-5 text-tiny text-soft">
              Take a screenshot — this code is not sent by SMS.
            </p>

            <Link to="/shop" className="mt-7 block border-b border-gold pb-0.5 text-gold">
              Have a look at the range
            </Link>

            <button
              onClick={() => {
                try { localStorage.removeItem(CODE_KEY) } catch { /* nothing to clear */ }
                setDone(null)
                setForm({ full_name: '', phone: '', email: '', product_slug: '' })
              }}
              className="mt-5 text-tiny text-soft underline underline-offset-4 hover:text-ink"
            >
              Someone else wants to sign up on this phone
            </button>
          </div>
        </section>
      </>
    )
  }

  /* ---------------------------------------------------- closed */
  if (!cfg.enabled) {
    return (
      <>
        <Seo title={`${cfg.name} — sampling closed`} noindex />
        <section className="shell grid min-h-[60vh] place-items-center py-20 text-center">
          <div className="max-w-[40ch]">
            <p className="script mb-2">That is a wrap</p>
            <h1 className="text-d3">{cfg.closed_message}</h1>
            <Link to="/shop" className="btn btn-solid mt-7">
              Browse the teas
            </Link>
          </div>
        </section>
      </>
    )
  }

  /* ---------------------------------------------------- the form */
  return (
    <>
      <Seo
        title={`${cfg.headline} — ${cfg.name}`}
        description={cfg.intro}
        noindex
      />

      <section className="shell max-w-[46rem] py-12 sm:py-16">
        <header className="text-center">
          <p className="script mb-1">{cfg.name}</p>
          <h1 className="text-d2">{cfg.headline}</h1>
          <p className="mx-auto mt-4 max-w-[46ch] text-lede text-soft">{cfg.intro}</p>
        </header>

        {problem && (
          <p
            role="alert"
            ref={liveRef}
            className="mt-8 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.06] px-4 py-3 text-[0.95rem] text-[#8F3623]"
          >
            {problem}
          </p>
        )}

        <form onSubmit={submit} className="mt-10 grid gap-7" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="full_name"
              label="Your name"
              value={form.full_name}
              onChange={set('full_name')}
              error={errors.full_name}
              autoComplete="name"
              autoFocus
            />
            <Field
              id="phone"
              label="Mobile number"
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={set('phone')}
              error={errors.phone}
              autoComplete="tel"
              hint="So we know it is you at the counter."
            />
            {cfg.collect_email && (
              <Field
                id="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
                autoComplete="email"
                className="sm:col-span-2"
                hint="Optional."
              />
            )}
          </div>

          {/* The choice is the point of the exercise, so it gets pictures
              and real estate rather than a dropdown. */}
          <fieldset>
            <legend className="label mb-3">Which one would you like to try?</legend>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cfg.products.map((p) => {
                const picked = form.product_slug === p.slug
                return (
                  <label
                    key={p.slug}
                    style={{ '--c-accent': hexToRgb(p.accent_color) }}
                    className={`relative cursor-pointer border p-3 text-center transition-all
                                ${picked
                                  ? 'border-accent bg-accent/[0.07]'
                                  : 'border-line hover:border-gold/60'}`}
                  >
                    <input
                      type="radio"
                      name="product_slug"
                      value={p.slug}
                      checked={picked}
                      onChange={() => {
                        setForm((f) => ({ ...f, product_slug: p.slug }))
                        setErrors((x) => ({ ...x, product_slug: undefined }))
                      }}
                      className="sr-only"
                    />
                    <img
                      src={`/products/${p.slug}-tile.jpg`}
                      alt=""
                      className="mx-auto aspect-square w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <span className="mt-2 block text-[0.95rem] text-ink">{p.name}</span>
                    {p.tagline && (
                      <span className="block text-micro text-soft">{p.tagline}</span>
                    )}

                    {picked && (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-paper">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <path d="M4 12l6 6L20 6" />
                        </svg>
                      </span>
                    )}
                  </label>
                )
              })}
            </div>

            {errors.product_slug && (
              <p className="mt-2 text-tiny text-[#8F3623]">{errors.product_slug}</p>
            )}
          </fieldset>

          <button disabled={busy} className="btn btn-solid w-full py-4 text-[1rem] disabled:opacity-50">
            {busy ? 'Sending…' : 'Claim my free cup'}
          </button>

          <p className="text-center text-tiny text-soft">
            We keep your name and number for this event only, to hand over your sample.
            Nothing is shared with anyone else.
          </p>
        </form>
      </section>
    </>
  )
}

function Field({ id, label, error, hint, className = '', ...props }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`field py-3.5 ${error ? 'border-[#B4472F]' : ''}`}
        aria-invalid={!!error}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-tiny text-[#8F3623]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-tiny text-soft">{hint}</p>
      ) : null}
    </div>
  )
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return '143 114 34'
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}
