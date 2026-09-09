import { Link } from 'react-router-dom'
import Seo from '../components/Seo'

export default function NotFound() {
  return (
    <>
      <Seo title="Page not found — ZION Herbs" noindex />
      <section className="shell grid min-h-[58vh] place-items-center py-20 text-center">
        <div className="max-w-[46ch]">
          <p className="script mb-2">Nothing steeping here</p>
          <h1 className="text-d2">We could not find that page</h1>
          <p className="mt-4 text-soft">
            The link may be old, or the address mistyped. The teas are all still where you left
            them.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/shop" className="btn btn-solid">Browse the teas</Link>
            <Link to="/" className="btn btn-ghost">Back home</Link>
          </div>
        </div>
      </section>
    </>
  )
}
