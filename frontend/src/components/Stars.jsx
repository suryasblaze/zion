/**
 * A rating, shown as stars.
 *
 * Renders nothing at all when there are no reviews. An empty row of
 * outlines on a new product reads as "rated zero" rather than "not
 * rated yet", which is worse than showing nothing — and every product
 * starts there.
 */
export default function Stars({ value = 0, count = 0, size = 13, showCount = true, className = '' }) {
  if (!count) return null

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex gap-0.5" aria-label={`${Number(value).toFixed(1)} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <svg
            key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
            fill={n <= Math.round(value) ? 'rgb(var(--c-gold-lit))' : 'none'}
            stroke="rgb(var(--c-gold))" strokeWidth="1.5"
          >
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
          </svg>
        ))}
      </span>
      {showCount && (
        <span className="nums text-tiny text-soft">
          {Number(value).toFixed(1)} ({count})
        </span>
      )}
    </span>
  )
}
