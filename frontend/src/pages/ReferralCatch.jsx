import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Seo from '../components/Seo'
import { api, visitorToken } from '../lib/api'

/**
 * Referral link landing: /r/PRIYA-K7M2Q
 *
 * Records the click, stores the code locally so it survives the walk to
 * the signup form, then shows who invited you and what you get. The code
 * is read again by AuthProvider.register() and sent with the account.
 */
export default function ReferralCatch() {
  const { code } = useParams()
  const [params] = useSearchParams()
  const [info, setInfo] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    if (!code) return
    localStorage.setItem('zion.ref', code.toUpperCase())
    localStorage.setItem('zion.ref_at', String(Date.now()))

    api
      .trackReferral(code, {
        visitor_token: visitorToken(),
        landing_path: window.location.pathname,
        referer: document.referrer || null,
        utm: {
          source: params.get('utm_source'),
          medium: params.get('utm_medium'),
          campaign: params.get('utm_campaign'),
        },
      })
      .then((res) => {
        setInfo(res)
        setState('ok')
      })
      // A dead link must never block someone from shopping.
      .catch(() => setState('unknown'))
  }, [code, params])

  return (
    <>
      <Seo
        title="You have been invited — ZION Herbs"
        description="A friend invited you to ZION Herbs. Claim your first-order discount on six caffeine-free herbal infusions."
        noindex
      />

      <section className="shell grid min-h-[62vh] place-items-center py-20">
        <div className="max-w-[54ch] text-center">
          {state === 'loading' && <p className="script">Checking your invitation…</p>}

          {state === 'ok' && (
            <>
              <p className="script mb-2">You have been invited</p>
              <h1 className="text-d1">
                {info?.referrer_name || 'A friend'} thinks you would like these
              </h1>
              <p className="mx-auto mt-6 max-w-[46ch] text-lede text-soft">
                {info?.discount_label ? (
                  <>
                    Create an account and your first order gets{' '}
                    <span className="text-gold">{info.discount_label}</span>. Six caffeine-free
                    infusions, hand-packed in Tamil Nadu.
                  </>
                ) : (
                  <>Six caffeine-free herbal infusions, hand-packed in Tamil Nadu.</>
                )}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/signup" className="btn btn-solid">
                  Claim my discount
                </Link>
                <Link to="/shop" className="btn btn-ghost">
                  Look around first
                </Link>
              </div>
              <p className="mt-5 text-tiny text-soft">
                Your discount is saved to this browser and applies at checkout.
              </p>
            </>
          )}

          {state === 'unknown' && (
            <>
              <p className="script mb-2">That link has expired</p>
              <h1 className="text-d2">We could not find that invitation</h1>
              <p className="mx-auto mt-5 max-w-[44ch] text-soft">
                The link may be old, or mistyped. You can still browse the range — and ask your
                friend to resend it from their account.
              </p>
              <Link to="/shop" className="btn btn-solid mt-7">
                Browse the teas
              </Link>
            </>
          )}
        </div>
      </section>
    </>
  )
}
