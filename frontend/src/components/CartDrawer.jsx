import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCart, useSettings } from '../context/StoreProvider'
import { inr } from '../lib/format'

export default function CartDrawer() {
  const { lines, open, setOpen, setQty, remove, subtotal, count } = useCart()
  const { get } = useSettings()

  const freeOver = Number(get('store.free_shipping_over', 999))
  const toFree = Math.max(0, freeOver - subtotal)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    if (open) document.addEventListener('keydown', onKey)
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-ink/35 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[430px] flex-col bg-paper
                    shadow-[-18px_0_50px_rgba(23,19,16,0.10)] transition-transform duration-400 ease-ease ${
                      open ? 'translate-x-0' : 'translate-x-full'
                    }`}
        role="dialog"
        aria-label="Your bag"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="text-d3">
            Your bag <span className="nums text-soft text-base">({count})</span>
          </h2>
          <button onClick={() => setOpen(false)} className="text-soft hover:text-ink" aria-label="Close bag">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="script">Nothing brewing yet</p>
            <p className="max-w-[28ch] text-soft">
              Six single-origin infusions, all caffeine free. Start with the discovery box if you
              cannot choose.
            </p>
            <Link to="/shop" onClick={() => setOpen(false)} className="btn btn-solid mt-2">
              Browse the teas
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              {lines.map((l) => (
                <div key={l.sku} className="flex gap-4 border-b border-line py-5 last:border-0">
                  <div
                    className="h-[86px] w-[66px] shrink-0 overflow-hidden bg-surface"
                    style={{ borderLeft: `2px solid ${l.accent || '#8F7222'}` }}
                  >
                    <img src={l.image} alt="" className="h-full w-full object-cover" />
                  </div>

                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div>
                        <h3 className="font-display text-[1.05rem] leading-tight">{l.name}</h3>
                        <p className="text-tiny text-soft">{l.label}</p>
                      </div>
                      <p className="nums font-display text-[1.02rem]">{inr(l.price * l.qty)}</p>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center border border-line">
                        <button
                          onClick={() => setQty(l.sku, l.qty - 1)}
                          className="px-3 py-1 text-soft hover:text-ink"
                          aria-label={`Reduce ${l.name}`}
                        >
                          −
                        </button>
                        <span className="nums w-8 text-center text-tiny">{l.qty}</span>
                        <button
                          onClick={() => setQty(l.sku, l.qty + 1)}
                          className="px-3 py-1 text-soft hover:text-ink"
                          aria-label={`Add another ${l.name}`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => remove(l.sku)}
                        className="text-tiny text-soft underline underline-offset-4 hover:text-ink"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line px-6 py-5">
              {toFree > 0 ? (
                <p className="mb-4 text-tiny text-soft">
                  <span className="nums text-ink">{inr(toFree)}</span> more for free delivery
                  <span className="mt-2 block h-[3px] w-full bg-line">
                    <span
                      className="block h-full bg-gold transition-all duration-500"
                      style={{ width: `${Math.min(100, (subtotal / freeOver) * 100)}%` }}
                    />
                  </span>
                </p>
              ) : (
                <p className="mb-4 text-tiny text-gold">Free delivery applied</p>
              )}

              <div className="mb-4 flex justify-between text-[1.05rem]">
                <span>Subtotal</span>
                <span className="nums font-display text-[1.25rem]">{inr(subtotal)}</span>
              </div>

              <Link to="/checkout" onClick={() => setOpen(false)} className="btn btn-solid w-full">
                Checkout
              </Link>
              <p className="mt-3 text-center text-tiny text-soft">
                Coins and referral discounts are applied at checkout.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
