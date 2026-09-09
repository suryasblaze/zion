import { useEffect } from 'react'

/**
 * Per-route metadata and structured data.
 *
 * The FAQPage and Product graphs are the answer-engine surface: they are
 * what assistants and AI search read when deciding whether to quote this
 * shop. Keep the answers here identical to the visible ones on the page --
 * mismatched schema is treated as cloaking.
 */
function setMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export default function Seo({ title, description, image, canonical, schema, noindex }) {
  useEffect(() => {
    if (title) document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:image', image)
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow')

    if (canonical) {
      let link = document.head.querySelector('link[rel="canonical"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.appendChild(link)
      }
      link.href = canonical
    }
  }, [title, description, image, canonical, noindex])

  useEffect(() => {
    if (!schema) return
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.dataset.route = 'true'
    el.textContent = JSON.stringify(schema)
    document.head.appendChild(el)
    return () => el.remove()
  }, [schema])

  return null
}

export const faqSchema = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q || f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.a || f.answer },
  })),
})

export const productSchema = (p, siteUrl = 'https://zionherbs.in') => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: `ZION ${p.name} Herbal Tea`,
  image: `${siteUrl}${p.image || p.hero_image}`,
  description: p.short || p.short_desc,
  brand: { '@type': 'Brand', name: 'ZION Herbs' },
  category: 'Herbal Tea',
  additionalProperty: [
    { '@type': 'PropertyValue', name: 'Botanical name', value: p.botanical || p.botanical_name },
    { '@type': 'PropertyValue', name: 'Caffeine', value: 'Caffeine free' },
    { '@type': 'PropertyValue', name: 'Origin', value: 'Tamil Nadu, India' },
  ].filter((x) => x.value),
  offers: (p.sizes || []).map((s) => ({
    '@type': 'Offer',
    sku: s.sku,
    name: s.label,
    price: s.price,
    priceCurrency: 'INR',
    availability: 'https://schema.org/InStock',
    url: `${siteUrl}/product/${p.slug}`,
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
    },
  })),
})
