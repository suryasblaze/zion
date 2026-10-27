import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/StoreProvider'

/**
 * Reviews under a product.
 *
 * Loaded from the API rather than taken from the catalogue, because the
 * catalogue is cached and a review someone just wrote should be there
 * when the page reloads.
 *
 * The form only appears for people who can actually use it. A "write a
 * review" box that answers "you have not bought this" is worse than no
 * box: it invites the effort and then refuses it.
 */

function Stars({ value, size = 15 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
          fill={n <= Math.round(value) ? 'rgb(var(--c-gold-lit))' : 'none'}
          stroke="rgb(var(--c-gold))" strokeWidth="1.4"
        >
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
        </svg>
      ))}
    </span>
  )
}

export default function Reviews({ slug, productName }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [canReview, setCanReview] = useState(null)   // null = not checked yet
  const [open, setOpen] = useState(false)

  const load = () =>
    api.product(slug, null).then((p) => p && setData(p)).catch(() => {})

  useEffect(() => { load() }, [slug])   // eslint-disable-line react-hooks/exhaustive-deps

  // Only signed-in visitors have anything to check.
  useEffect(() => {
    if (!user) { setCanReview(null); return }
    api
      .reviewable()
      .then((rows) => {
        const mine = (rows || []).find((r) => r.slug === slug)
        setCanReview(mine && !mine.review_id ? mine : null)
      })
      .catch(() => setCanReview(null))
  }, [user, slug])

  const reviews = data?.reviews || []
  const count = reviews.length
  const average = count
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / count
    : 0

  return (
    <section className="border-t border-line py-16" id="reviews">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="script mb-1">What people say</p>
            <h2 className="text-d2">Reviews</h2>
          </div>

          {count > 0 && (
            <div className="text-right">
              <Stars value={average} size={19} />
              <p className="nums mt-1 text-tiny text-soft">
                {average.toFixed(1)} from {count} {count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          )}
        </div>

        {canReview && !open && (
          <button onClick={() => setOpen(true)} className="btn btn-gold mt-7">
            Write a review
          </button>
        )}

        {open && (
          <ReviewForm
            slug={slug}
            productName={productName}
            onDone={() => { setOpen(false); setCanReview(null); load() }}
            onCancel={() => setOpen(false)}
          />
        )}

        {count === 0 ? (
          <div className="mt-8 border border-line bg-surface p-8">
            <p className="text-soft">
              No reviews yet.{' '}
              {user
                ? canReview
                  ? 'You have had this one — tell people what you thought.'
                  : 'Reviews come from people who have had the tea, so they take a little while to arrive.'
                : 'Reviews come from people who have had the tea.'}
            </p>
            {!user && (
              <Link to="/signin" className="mt-4 inline-block text-tiny text-gold underline underline-offset-4">
                Sign in
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-9 grid gap-px border-t border-line sm:grid-cols-2">
            {reviews.map((r, i) => (
              <li key={i} className="border-b border-r border-line bg-paper p-7">
                <div className="flex items-center justify-between gap-4">
                  <Stars value={r.rating} />
                  {r.is_verified && (
                    <span className="border border-line px-2 py-0.5 text-micro uppercase tracking-wide text-soft">
                      Verified buyer
                    </span>
                  )}
                </div>

                {r.title && <h3 className="mt-3 text-[1.05rem]">{r.title}</h3>}
                {r.body && <p className="mt-2 text-soft">{r.body}</p>}

                <p className="mt-4 text-tiny text-soft">
                  {r.author_name}
                  {r.created_at && (
                    <> · {new Date(r.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}</>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function ReviewForm({ slug, productName, onDone, onCancel }) {
  const [rating, setRating] = useState(0)
  const [form, setForm] = useState({ title: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!rating) { setError('Pick a rating first.'); return }

    setBusy(true)
    setError(null)
    try {
      const res = await api.addReview(slug, { rating, ...form })
      // Auto-approve is a setting, so the message has to come from the
      // server -- the page cannot know whether this is live yet.
      setDone(res?.is_approved
        ? 'Thank you — your review is live.'
        : 'Thank you. It will appear once we have read it.')
      setTimeout(onDone, 2200)
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mt-7 border-l-2 border-gold bg-gold/[0.06] px-5 py-4">
        <p>{done}</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-7 border border-line p-7" noValidate>
      <p className="script mb-1">Your turn</p>
      <h3 className="text-d3">How was the {productName}?</h3>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-[#B4472F] bg-[#B4472F]/[0.06] px-4 py-3 text-[0.92rem] text-[#8F3623]">
          {error}
        </p>
      )}

      <div className="mt-5">
        <span className="label">Rating</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setRating(n); setError(null) }}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              aria-pressed={rating === n}
              className="transition-transform hover:scale-110"
            >
              <svg
                width="30" height="30" viewBox="0 0 24 24"
                fill={n <= rating ? 'rgb(var(--c-gold-lit))' : 'none'}
                stroke="rgb(var(--c-gold))" strokeWidth="1.3"
              >
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label className="label" htmlFor="review-title">Headline</label>
        <input
          id="review-title"
          value={form.title}
          maxLength={120}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Optional"
          className="field py-3"
        />
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="review-body">Your review</label>
        <textarea
          id="review-body"
          rows={5}
          maxLength={4000}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder="How did it taste? How do you brew it? Would you buy it again?"
          className="field py-3"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="btn btn-gold disabled:opacity-60">
          {busy ? 'Sending…' : 'Post review'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  )
}
