import { useCallback, useEffect, useState } from 'react'
import { adminApi } from './adminApi'
import { SCHEMAS } from './schemas'
import { Empty, PageHead, Pill, Toast } from './AdminShell'
import MediaPicker from './MediaPicker'
import { inr, num } from '../lib/format'

/**
 * One table view and one editor, driven by SCHEMAS. Every collection in
 * the panel uses this, so a fix to the editor is a fix everywhere.
 */
export default function Collection({ table, embedded = false }) {
  const schema = SCHEMAS[table]
  const [rows, setRows] = useState([])
  const [refs, setRefs] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : ''
      setRows((await adminApi.list(table, q)) || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [table, search])

  useEffect(() => {
    load()
  }, [load])

  // Pull in anything this schema references, for the picker fields.
  useEffect(() => {
    const needed = (schema?.fields || []).filter((f) => f.type === 'ref').map((f) => f.ref)
    needed.forEach((t) => {
      if (refs[t]) return
      adminApi.list(t, '?limit=200').then((r) => setRefs((x) => ({ ...x, [t]: r || [] }))).catch(() => {})
    })
  }, [schema, refs])

  if (!schema) return <PageHead title="Unknown collection" />

  const save = async (values) => {
    try {
      if (values.id) {
        const { id, ...rest } = values
        await adminApi.update(table, id, rest)
      } else {
        await adminApi.create(table, values)
      }
      setToast({ text: 'Saved.' })
      setEditing(null)
      load()
    } catch (e) {
      setToast({ text: e.message, tone: e.demo ? 'ok' : 'error' })
      throw e
    }
  }

  const remove = async (row) => {
    const name = row.name || row.title || row.label || row.question || row.code || 'this record'
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return
    try {
      await adminApi.remove(table, row.id)
      setToast({ text: 'Deleted.' })
      load()
    } catch (e) {
      setToast({ text: e.message, tone: 'error' })
    }
  }

  return (
    <>
      {!embedded && (
        <PageHead title={schema.title} sub={schema.sub}>
          <button onClick={() => setEditing({ ...schema.defaults })} className="btn btn-solid px-5 py-2.5 text-tiny">
            Add {schema.singular}
          </button>
        </PageHead>
      )}

      <div className={embedded ? '' : 'p-6 lg:p-9'}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${schema.title.toLowerCase()}…`}
            className="field max-w-[300px] py-2"
          />
          {embedded && (
            <button onClick={() => setEditing({ ...schema.defaults })} className="btn btn-solid ml-auto px-5 py-2.5 text-tiny">
              Add {schema.singular}
            </button>
          )}
          <span className="nums text-tiny text-soft">{num(rows.length)} shown</span>
        </div>

        {error ? (
          <p className="border-l-2 border-[#B4472F] bg-[#B4472F]/[0.05] px-5 py-4 text-[#8F3623]">
            {error}
          </p>
        ) : loading ? (
          <p className="py-12 text-center text-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <Empty
            title={search ? 'Nothing matches that' : `No ${schema.title.toLowerCase()} yet`}
            body={search ? 'Try a shorter search.' : `Add your first ${schema.singular} to get started.`}
          >
            <button onClick={() => setEditing({ ...schema.defaults })} className="btn btn-solid">
              Add {schema.singular}
            </button>
          </Empty>
        ) : (
          <div className="overflow-x-auto border border-line bg-paper">
            <table className="w-full min-w-[620px] text-left text-[0.9rem]">
              <thead className="border-b border-line bg-surface text-micro uppercase tracking-wide text-soft">
                <tr>
                  {schema.columns.map((c) => (
                    <th key={c.key} className={`px-4 py-3 font-normal ${c.type === 'num' || c.type === 'money' ? 'text-right' : ''}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-normal">Edit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                    {schema.columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 ${c.type === 'num' || c.type === 'money' ? 'nums text-right' : ''} ${c.muted ? 'text-soft' : ''}`}>
                        <Cell col={c} row={row} />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => setEditing(row)} className="text-gold hover:underline">
                        Edit
                      </button>
                      <button onClick={() => remove(row)} className="ml-4 text-soft hover:text-[#8F3623]">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Editor
          schema={schema}
          value={editing}
          refs={refs}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      {toast && (
        <Toast tone={toast.tone} onDone={() => setToast(null)}>
          {toast.text}
        </Toast>
      )}
    </>
  )
}

function Cell({ col, row }) {
  const v = row[col.key]
  if (col.type === 'bool')
    return <Pill tone={v ? 'good' : 'neutral'}>{v ? 'Yes' : 'No'}</Pill>
  if (col.type === 'swatch')
    return (
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 border border-line" style={{ background: v }} />
        <span className="nums text-tiny text-soft">{v}</span>
      </span>
    )
  if (col.type === 'money') return inr(v)
  if (col.type === 'num') return v == null ? '—' : num(v)
  if (col.primary)
    return (
      <span>
        <span className="block">{v || '—'}</span>
        {col.sub && row[col.sub] && (
          <span className="block text-micro text-soft">{row[col.sub]}</span>
        )}
      </span>
    )
  return <span className="line-clamp-2">{v == null || v === '' ? '—' : String(v)}</span>
}

/* ==================================================================== */
function Editor({ schema, value, refs, onClose, onSave }) {
  const [form, setForm] = useState(() => normalise(value, schema))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v }))
    setProblem(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    const missing = schema.fields.find(
      (f) => f.required && (form[f.key] === '' || form[f.key] == null)
    )
    if (missing) return setProblem(`${missing.label} is required.`)

    setBusy(true)
    try {
      await onSave(denormalise(form, schema))
    } catch {
      /* toast already shown by the caller */
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[55] bg-ink/30" aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={`${value.id ? 'Edit' : 'New'} ${schema.singular}`}
        className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-[560px] flex-col bg-paper shadow-[-18px_0_50px_rgba(23,19,16,0.14)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-[1.25rem]">
            {value.id ? `Edit ${schema.singular}` : `New ${schema.singular}`}
          </h2>
          <button onClick={onClose} className="text-soft hover:text-ink" aria-label="Close">
            ✕
          </button>
        </header>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {problem && (
              <p className="mb-5 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.05] px-4 py-3 text-tiny text-[#8F3623]">
                {problem}
              </p>
            )}
            <div className="grid gap-5">
              {schema.fields.map((f) => (
                <Field key={f.key} field={f} value={form[f.key]} onChange={set(f.key)} refs={refs} />
              ))}
            </div>
          </div>

          <footer className="flex items-center gap-3 border-t border-line px-6 py-4">
            <button disabled={busy} className="btn btn-solid px-6 py-2.5 disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost px-6 py-2.5">
              Cancel
            </button>
          </footer>
        </form>
      </aside>
    </>
  )
}

/* JSON columns arrive as objects; the textareas want strings. */
function normalise(row, schema) {
  const out = { ...row }
  schema.fields.forEach((f) => {
    if (f.type === 'json' && typeof out[f.key] !== 'string') {
      out[f.key] = JSON.stringify(out[f.key] ?? (f.key === 'seo' ? {} : {}), null, 2)
    }
    if ((f.type === 'list' || f.type === 'benefits') && !Array.isArray(out[f.key])) {
      out[f.key] = []
    }
    if (out[f.key] == null && f.type === 'toggle') out[f.key] = false
  })
  return out
}

function denormalise(form, schema) {
  const out = { ...form }
  schema.fields.forEach((f) => {
    if (f.type === 'json' && typeof out[f.key] === 'string') {
      try {
        out[f.key] = JSON.parse(out[f.key] || '{}')
      } catch {
        out[f.key] = {}
      }
    }
    if (f.type === 'number' || f.type === 'money') {
      out[f.key] = out[f.key] === '' || out[f.key] == null ? null : Number(out[f.key])
    }
  })
  delete out.created_at
  delete out.updated_at
  return out
}

/* ==================================================================== */
function Field({ field: f, value, onChange, refs }) {
  const id = `f-${f.key}`

  const label = (
    <label className="label" htmlFor={id}>
      {f.label}
      {f.required && <span className="text-[#B4472F]"> *</span>}
    </label>
  )
  const hint = f.hint && <p className="mt-1.5 text-tiny text-soft">{f.hint}</p>

  if (f.type === 'toggle')
    return (
      <div className="flex items-start gap-3">
        <button
          type="button"
          id={id}
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
        <div>
          <span className="text-[0.95rem]">{f.label}</span>
          {hint}
        </div>
      </div>
    )

  if (f.type === 'select')
    return (
      <div>
        {label}
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="field">
          <option value="">Choose…</option>
          {f.options.map((o) => (
            <option key={o} value={o}>{String(o)}</option>
          ))}
        </select>
        {hint}
      </div>
    )

  if (f.type === 'ref') {
    const list = refs[f.ref] || []
    return (
      <div>
        {label}
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="field">
          <option value="">Choose…</option>
          {list.map((r) => (
            <option key={r.id} value={r.id}>{r.name || r.title || r.id}</option>
          ))}
        </select>
        {hint}
      </div>
    )
  }

  if (f.type === 'color')
    return (
      <div>
        {label}
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={value || '#8F7222'}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-14 cursor-pointer border border-line bg-paper p-1"
            aria-label={f.label}
          />
          <input
            id={id}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="field nums"
            placeholder="#8F7222"
          />
        </div>
        {hint}
      </div>
    )

  if (f.type === 'textarea' || f.type === 'rich' || f.type === 'json')
    return (
      <div>
        {label}
        <textarea
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={f.type === 'rich' ? 7 : f.type === 'json' ? 6 : 3}
          className={`field ${f.type === 'json' ? 'font-mono text-tiny' : ''}`}
          spellCheck={f.type !== 'json'}
        />
        {hint}
      </div>
    )

  if (f.type === 'list') return <ListField id={id} f={f} value={value} onChange={onChange} label={label} hint={hint} />
  if (f.type === 'benefits') return <BenefitsField f={f} value={value} onChange={onChange} label={label} hint={hint} />

  if (f.type === 'image')
    return (
      <div>
        {label}
        <MediaPicker id={id} value={value} onChange={onChange} folder={f.folder || 'uploads'} />
        {hint}
      </div>
    )

  return (
    <div>
      {label}
      <div className="flex items-center">
        {f.prefix && (
          <span className="border border-r-0 border-line bg-surface px-3 py-3 text-tiny text-soft">
            {f.prefix}
          </span>
        )}
        <input
          id={id}
          type={f.type === 'datetime' ? 'datetime-local' : f.type === 'number' || f.type === 'money' ? 'number' : 'text'}
          step={f.type === 'money' ? '0.01' : undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`field ${f.type === 'number' || f.type === 'money' ? 'nums' : ''}`}
        />
      </div>
      {hint}
    </div>
  )
}

function ListField({ f, value = [], onChange, label, hint }) {
  const items = Array.isArray(value) ? value : []
  return (
    <div>
      {label}
      <div className="grid gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              className="field"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="shrink-0 border border-line px-3 text-soft hover:border-[#B4472F] hover:text-[#8F3623]"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="justify-self-start border border-line px-4 py-2 text-tiny text-soft hover:border-gold hover:text-gold"
        >
          Add another
        </button>
      </div>
      {hint}
    </div>
  )
}

function BenefitsField({ value = [], onChange, label, hint }) {
  const items = Array.isArray(value) ? value : []
  const setAt = (i, key, v) => {
    const next = [...items]
    next[i] = { ...next[i], [key]: v }
    onChange(next)
  }
  return (
    <div>
      {label}
      <div className="grid gap-3">
        {items.map((b, i) => (
          <div key={i} className="border border-line p-3">
            <div className="mb-2 flex gap-2">
              <input
                value={b.title || ''}
                onChange={(e) => setAt(i, 'title', e.target.value)}
                placeholder="Benefit"
                className="field py-2"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="shrink-0 border border-line px-3 text-soft hover:border-[#B4472F] hover:text-[#8F3623]"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
            <textarea
              value={b.body || ''}
              onChange={(e) => setAt(i, 'body', e.target.value)}
              placeholder="What it does, in one sentence."
              rows={2}
              className="field"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, { title: '', body: '' }])}
          className="justify-self-start border border-line px-4 py-2 text-tiny text-soft hover:border-gold hover:text-gold"
        >
          Add a benefit
        </button>
      </div>
      {hint}
    </div>
  )
}
