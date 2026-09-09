import { useEffect, useState } from 'react'
import { adminApi } from './adminApi'
import { PageHead, Pill, Toast } from './AdminShell'

/**
 * Design studio.
 *
 * A theme is a token set. Editing one here writes values the storefront
 * reads at runtime and sprays onto :root, so publishing a restyle needs
 * no rebuild and no deploy. The preview below is rendered with the same
 * tokens, so what you see is what the shop gets.
 */

const COLOR_FIELDS = [
  ['paper', 'Page background', 'The main ground the site sits on.'],
  ['surface', 'Raised background', 'Alternate sections, table headers, cards.'],
  ['ink', 'Text', 'Body and heading colour.'],
  ['soft', 'Muted text', 'Secondary copy. Must stay readable on the page background.'],
  ['line', 'Hairlines', 'Borders and rules.'],
  ['gold', 'Accent', 'Links, highlights, buttons. Dark enough to read as text.'],
  ['gold-lit', 'Accent, light', 'Fills and rules only — never text.'],
]

const FONT_OPTIONS = {
  display: ['Marcellus', 'Cormorant Garamond', 'Playfair Display', 'Lora', 'Spectral', 'Gilda Display'],
  body: ['Jost', 'Inter', 'Karla', 'Work Sans', 'Nunito Sans', 'DM Sans'],
  script: ['Italianno', 'Petit Formal Script', 'Parisienne', 'Great Vibes'],
}

export default function DesignStudio() {
  const [themes, setThemes] = useState([])
  const [current, setCurrent] = useState(null)
  const [tokens, setTokens] = useState(null)
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminApi
      .list('theme_presets')
      .then((rows) => {
        setThemes(rows || [])
        const active = (rows || []).find((t) => t.is_active) || (rows || [])[0]
        setCurrent(active)
        setTokens(structuredClone(active?.tokens || {}))
      })
      .catch((e) => setToast({ text: e.message, tone: 'error' }))
  }, [])

  if (!current || !tokens)
    return <><PageHead title="Design studio" /><p className="p-9 text-soft">Loading themes…</p></>

  const setColor = (key, value) =>
    setTokens((t) => ({ ...t, color: { ...(t.color || {}), [key]: value } }))
  const setFont = (role, value) =>
    setTokens((t) => ({ ...t, font: { ...(t.font || {}), [role]: value } }))
  const setScale = (key, value) =>
    setTokens((t) => ({ ...t, scale: { ...(t.scale || {}), [key]: value } }))

  const save = async () => {
    setBusy(true)
    try {
      await adminApi.update('theme_presets', current.id, { tokens })
      setToast({ text: 'Theme saved. Reload the shop to see it.' })
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    setBusy(true)
    try {
      await adminApi.update('theme_presets', current.id, { tokens })
      await adminApi.activateTheme(current.id)
      setThemes((ts) => ts.map((t) => ({ ...t, is_active: t.id === current.id })))
      setToast({ text: `“${current.name}” is now live on the storefront.` })
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async () => {
    const name = window.prompt('Name for the copy', `${current.name} copy`)
    if (!name) return
    try {
      const created = await adminApi.create('theme_presets', {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: `Based on ${current.name}`,
        tokens,
      })
      setThemes((ts) => [...ts, created])
      setCurrent(created)
      setToast({ text: 'Copy created. Edit it freely — the original is untouched.' })
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    }
  }

  const c = tokens.color || {}
  const f = tokens.font || {}

  return (
    <>
      <PageHead
        title="Design studio"
        sub="Change how the shop looks without touching code. Save to keep a draft; publish to put it live."
      >
        <button onClick={duplicate} className="btn btn-ghost px-5 py-2.5 text-tiny">Duplicate</button>
        <button onClick={save} disabled={busy} className="btn btn-ghost px-5 py-2.5 text-tiny disabled:opacity-50">
          Save draft
        </button>
        <button onClick={publish} disabled={busy} className="btn btn-solid px-5 py-2.5 text-tiny disabled:opacity-50">
          {busy ? 'Working…' : 'Publish'}
        </button>
      </PageHead>

      <div className="p-6 lg:p-9">
        {/* theme picker */}
        <div className="mb-8 flex flex-wrap gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setCurrent(t)
                setTokens(structuredClone(t.tokens || {}))
              }}
              className={`border px-4 py-2.5 text-left transition-colors ${
                current.id === t.id ? 'border-gold bg-gold/[0.06]' : 'border-line hover:border-gold'
              }`}
            >
              <span className="block text-[0.92rem]">{t.name}</span>
              <span className="mt-1 flex items-center gap-1.5">
                {Object.values(t.tokens?.color || {}).slice(0, 5).map((hex, i) => (
                  <span key={i} className="inline-block h-3 w-3 border border-line" style={{ background: hex }} />
                ))}
                {t.is_active && <Pill tone="good">Live</Pill>}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* -------------------------------------------- controls */}
          <div className="grid gap-8">
            <section>
              <h2 className="mb-4 font-display text-[1.15rem]">Colours</h2>
              <div className="grid gap-4">
                {COLOR_FIELDS.map(([key, label, hint]) => (
                  <div key={key}>
                    <label className="label" htmlFor={`c-${key}`}>{label}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={c[key] || '#000000'}
                        onChange={(e) => setColor(key, e.target.value)}
                        className="h-10 w-12 shrink-0 cursor-pointer border border-line bg-paper p-1"
                        aria-label={label}
                      />
                      <input
                        id={`c-${key}`}
                        value={c[key] || ''}
                        onChange={(e) => setColor(key, e.target.value)}
                        className="field nums py-2"
                      />
                    </div>
                    <p className="mt-1 text-tiny text-soft">{hint}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-4 font-display text-[1.15rem]">Type</h2>
              <div className="grid gap-4">
                {[
                  ['display', 'Headings'],
                  ['body', 'Body and buttons'],
                  ['script', 'Script accent'],
                ].map(([role, label]) => (
                  <div key={role}>
                    <label className="label" htmlFor={`f-${role}`}>{label}</label>
                    <select
                      id={`f-${role}`}
                      value={f[role] || ''}
                      onChange={(e) => setFont(role, e.target.value)}
                      className="field"
                    >
                      {FONT_OPTIONS[role].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <p className="text-tiny text-soft">
                  These load from Google Fonts. A face not listed here needs adding to the font
                  link in index.html first.
                </p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 font-display text-[1.15rem]">Shape</h2>
              <div className="grid gap-4">
                <div>
                  <label className="label" htmlFor="radius">Corner rounding</label>
                  <input
                    id="radius"
                    value={(tokens.scale || {}).radius || '2px'}
                    onChange={(e) => setScale('radius', e.target.value)}
                    className="field nums py-2"
                    placeholder="2px"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="width">Content width</label>
                  <input
                    id="width"
                    value={(tokens.scale || {}).maxWidth || '1240px'}
                    onChange={(e) => setScale('maxWidth', e.target.value)}
                    className="field nums py-2"
                    placeholder="1240px"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* -------------------------------------------- preview */}
          <section>
            <h2 className="mb-4 font-display text-[1.15rem]">Preview</h2>
            <div
              className="border border-line p-9"
              style={{
                background: c.paper,
                color: c.ink,
                fontFamily: `"${f.body || 'Jost'}", system-ui, sans-serif`,
                borderRadius: (tokens.scale || {}).radius,
              }}
            >
              <p style={{ fontFamily: `"${f.script || 'Italianno'}", cursive`, color: c.gold, fontSize: '2rem', lineHeight: 1 }}>
                Six nature, one wellness
              </p>
              <h3
                style={{
                  fontFamily: `"${f.display || 'Marcellus'}", serif`,
                  fontSize: '2.4rem',
                  lineHeight: 1.1,
                  margin: '0.4rem 0 0.9rem',
                }}
              >
                The whole flower. Nothing else in the tin.
              </h3>
              <p style={{ color: c.soft, maxWidth: '46ch', lineHeight: 1.65 }}>
                Whole butterfly pea flowers, picked and dried in Tamil Nadu. Brews a deep indigo in
                thirty seconds, and swings to violet the moment you add lime.
              </p>

              <div style={{ display: 'flex', gap: '2rem', borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}`, padding: '0.9rem 0', margin: '1.6rem 0', maxWidth: '46ch', fontSize: '0.82rem', color: c.soft }}>
                <span>Brew <b style={{ color: c.ink, fontWeight: 400 }}>90°C</b></span>
                <span>Steep <b style={{ color: c.ink, fontWeight: 400 }}>4 min</b></span>
                <span>From <b style={{ color: c.ink, fontWeight: 400 }}>₹349</b></span>
              </div>

              <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                <span style={{ background: c.ink, color: c.paper, padding: '0.8rem 1.7rem', borderRadius: (tokens.scale || {}).radius, fontSize: '0.9rem' }}>
                  Add to bag
                </span>
                <span style={{ border: `1px solid ${c.line}`, padding: '0.8rem 1.7rem', borderRadius: (tokens.scale || {}).radius, fontSize: '0.9rem' }}>
                  Try all six
                </span>
                <span style={{ background: c.gold, color: c.paper, padding: '0.8rem 1.7rem', borderRadius: (tokens.scale || {}).radius, fontSize: '0.9rem' }}>
                  Get my link
                </span>
              </div>

              <div style={{ marginTop: '2rem', background: c.surface, padding: '1.4rem', borderRadius: (tokens.scale || {}).radius }}>
                <p style={{ fontSize: '0.82rem', color: c.soft }}>Raised surface</p>
                <p style={{ marginTop: '0.3rem' }}>Tables, alternate sections and the chat panel sit on this.</p>
              </div>
            </div>

            <Contrast c={c} />
          </section>
        </div>
      </div>

      {toast && <Toast tone={toast.tone} onDone={() => setToast(null)}>{toast.text}</Toast>}
    </>
  )
}

/* Readability is not a matter of taste, so it is checked rather than left
   to the eye. Ratios follow WCAG 2.1 relative luminance. */
function Contrast({ c }) {
  const pairs = [
    ['Body text', c.ink, c.paper, 4.5],
    ['Muted text', c.soft, c.paper, 4.5],
    ['Accent as text', c.gold, c.paper, 4.5],
    ['Text on raised', c.ink, c.surface, 4.5],
  ]
  return (
    <div className="mt-6 border border-line bg-paper p-5">
      <h3 className="mb-3 font-display text-[1.05rem]">Readability</h3>
      <div className="grid gap-2">
        {pairs.map(([label, fg, bg, min]) => {
          const r = ratio(fg, bg)
          const pass = r >= min
          return (
            <div key={label} className="flex items-center justify-between gap-4 text-[0.9rem]">
              <span className="text-soft">{label}</span>
              <span className="flex items-center gap-3">
                <span className="nums">{r ? r.toFixed(1) : '—'}:1</span>
                <Pill tone={pass ? 'good' : 'bad'}>{pass ? 'Passes' : 'Too low'}</Pill>
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-tiny text-soft">
        4.5:1 is the minimum for normal text. Anything marked too low will be hard to read for
        some customers.
      </p>
    </div>
  )
}

function lum(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return null
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const la = lum(a)
  const lb = lum(b)
  if (la == null || lb == null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
