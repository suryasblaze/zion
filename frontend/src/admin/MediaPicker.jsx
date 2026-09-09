import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadMedia } from '../lib/api'
import { isDemo } from '../data/demo'
import { adminApi } from './adminApi'

/**
 * The image field.
 *
 * Shows the current image, and offers three ways to change it: drop a file,
 * pick one already uploaded, or paste a URL. The URL box is always there —
 * Supabase Storage is optional, and without it that is the only route, so
 * it should not feel like the fallback.
 */
export default function MediaPicker({ id, value, onChange, folder = 'uploads' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)

  const send = async (file) => {
    if (!file) return
    if (isDemo()) {
      setError('Demo mode is read-only — uploading would work on a live shop.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const asset = await uploadMedia(file, { folder })
      onChange(asset.url)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          send(e.dataTransfer.files?.[0])
        }}
        className={`flex items-center gap-4 border p-3 transition-colors ${
          dragging ? 'border-gold bg-gold/[0.05]' : 'border-line'
        }`}
      >
        {value ? (
          <img
            src={value}
            alt=""
            className="h-16 w-16 shrink-0 border border-line object-cover"
            onError={(e) => {
              e.currentTarget.style.opacity = '0.25'
            }}
          />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center border border-dashed border-line text-micro text-soft">
            none
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="border border-line px-3 py-1.5 text-tiny text-soft transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
            >
              {busy ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="border border-line px-3 py-1.5 text-tiny text-soft transition-colors hover:border-gold hover:text-gold"
            >
              Library
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="border border-line px-3 py-1.5 text-tiny text-soft transition-colors hover:border-[#B4472F] hover:text-[#8F3623]"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-micro text-soft">
            Drop a file here, or paste an address below. JPEG, PNG, WebP or SVG, up to 8 MB.
          </p>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => send(e.target.files?.[0])}
        />
      </div>

      <input
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/products/hibiscus.jpg  or  https://…"
        className="field mt-2"
      />

      {error && <p className="mt-1.5 text-tiny text-[#8F3623]">{error}</p>}

      {open && (
        <Library
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onChange(url)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function Library({ onClose, onPick }) {
  const [items, setItems] = useState(null)
  const [meta, setMeta] = useState({})
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    adminApi
      .media('?limit=120')
      .then((rows) => {
        setItems(rows || [])
        setError(null)
      })
      .catch((e) => {
        setItems([])
        setError(e.message)
      })
  }, [])

  useEffect(() => {
    load()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [load, onClose])

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.filename}? This cannot be undone.`)) return
    try {
      await adminApi.deleteMedia(item.id)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-ink/35" aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Image library"
        className="fixed left-1/2 top-1/2 z-[61] flex max-h-[80vh] w-[min(860px,calc(100vw-2rem))]
                   -translate-x-1/2 -translate-y-1/2 flex-col border border-line bg-paper
                   shadow-[0_24px_70px_rgba(23,19,16,0.22)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-[1.2rem]">Image library</h2>
          <button onClick={onClose} className="text-soft hover:text-ink" aria-label="Close">
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-5 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.05] px-4 py-3 text-[0.92rem] text-[#8F3623]">
              {error}
            </p>
          )}

          {items === null ? (
            <p className="py-12 text-center text-soft">Loading…</p>
          ) : items.length === 0 ? (
            <div className="border border-line py-14 text-center">
              <p className="font-display text-[1.1rem]">Nothing uploaded yet</p>
              <p className="mx-auto mt-2 max-w-[48ch] text-soft">
                Close this and use <span className="text-ink">Upload</span>, or drop a file onto
                the image box. If uploading is switched off, paste an image address instead.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <figure key={item.id} className="group relative m-0 border border-line">
                  <button
                    type="button"
                    onClick={() => onPick(item.url)}
                    className="block w-full"
                    title={item.filename}
                  >
                    <img
                      src={item.url}
                      alt={item.alt || ''}
                      className="aspect-square w-full bg-surface object-cover"
                      loading="lazy"
                    />
                  </button>
                  <figcaption className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-2">
                    <span className="truncate text-micro text-soft" title={item.filename}>
                      {item.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="shrink-0 text-micro text-soft hover:text-[#8F3623]"
                    >
                      Delete
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
