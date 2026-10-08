/**
 * An <img> that prefers the WebP beside it.
 *
 * Every photograph in public/ ships as both .jpg and .webp, and the WebP
 * is roughly 30% smaller. Nothing was reaching for it: the markup asked
 * for the JPEG by name, so the WebP files were downloaded by no one and
 * the home page cost about a megabyte of photographs it did not need to.
 *
 * The swap is a <picture>: browsers that understand WebP take the
 * <source>, the rest fall through to the JPEG in the <img>. No server
 * configuration, so it behaves the same on nginx and on Vercel.
 *
 * Only local artwork gets a WebP sibling. Images uploaded through the
 * admin live in Supabase Storage with no converted copy, and pointing a
 * <source> at one that does not exist shows a broken image in exactly
 * the browsers that support the format.
 */
const LOCAL_ART = /^\/(products|brand)\/[^?#]+\.(jpe?g|png)$/i

/** The WebP beside a local artwork path, or null if there isn't one. */
export function webpFor(src) {
  return src && LOCAL_ART.test(src) ? src.replace(/\.(jpe?g|png)$/i, '.webp') : null
}

let webpOk = null
function supportsWebp() {
  if (webpOk === null) {
    try {
      webpOk = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')
    } catch {
      webpOk = false
    }
  }
  return webpOk
}

/**
 * The URL to warm the cache with, for code that preloads by hand.
 *
 * It has to resolve to the same file <picture> will pick, or the preload
 * fetches one format and the render fetches the other -- paying for both
 * and benefiting from neither.
 */
export function preloadSrc(src) {
  const webp = webpFor(src)
  return webp && supportsWebp() ? webp : src
}

export default function Img({ src, alt = '', className, width, height, loading = 'lazy', priority = false, ...rest }) {
  const webp = webpFor(src)

  // display:contents keeps <picture> from adding a box of its own, so
  // the <img> sits in the parent's grid or flex exactly as it did
  // before the element was wrapped.
  return (
    <picture className="contents">
      {webp && <source srcSet={webp} type="image/webp" />}
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        /* The hero is the largest contentful paint; waiting for it in
           the lazy queue is the difference between a fast page and one
           that looks broken for a beat. */
        loading={priority ? 'eager' : loading}
        fetchpriority={priority ? 'high' : undefined}
        decoding={priority ? 'sync' : 'async'}
        {...rest}
      />
    </picture>
  )
}
