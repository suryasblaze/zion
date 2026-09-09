export const inr = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

export const num = (n) => new Intl.NumberFormat('en-IN').format(Number(n) || 0)

/** '#2B3F8C' -> '43 63 140', the form our CSS custom properties expect. */
export function hexToRgbChannels(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return '143 114 34'
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}

/** Paint a product's identity colour onto any element (usually a section). */
export function accentStyle(product) {
  if (!product) return undefined
  return {
    '--c-accent': hexToRgbChannels(product.accent || product.accent_color),
    '--c-accent-deep': hexToRgbChannels(
      product.accentDeep || product.accent_soft || product.accent || product.accent_color
    ),
  }
}

export const discountPct = (price, mrp) =>
  mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0
