/**
 * The public address of the shop.
 *
 * Canonical tags, OpenGraph URLs and the Product schema all have to agree
 * with each other and with what the backend puts in the sitemap, or search
 * engines treat the mismatch as cloaking. They were each carrying their own
 * copy of the domain; this is the one place it is written now.
 *
 * Overridable at build time for a staging domain:
 *   VITE_SITE_URL=https://staging.zionherbs.com npm run build
 *
 * The backend's PUBLIC_SITE_URL must match. Both are the same address seen
 * from two sides -- nothing derives one from the other at runtime, because
 * the frontend is static files that never ask the API where they live.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://zionherbs.com').replace(/\/+$/, '')

/** Absolute URL for a route. `canonical('/shop')` -> https://zionherbs.com/shop */
export const canonical = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
