/**
 * API client.
 *
 * Every call goes through request(). When the backend is not running,
 * callers that pass a `fallback` get the local catalogue instead of an
 * error, so the storefront is developable before Supabase is connected.
 */
import { demoStorefront, isDemo } from '../data/demo'

const BASE = import.meta.env.VITE_API_URL || '/api'

const TOKEN_KEY = 'zion.token'
const REFRESH_KEY = 'zion.refresh'

export const tokens = {
  get: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: ({ access_token, refresh_token }) => {
    if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

export async function request(path, { method = 'GET', body, auth = false, fallback } = {}) {
  // Demo mode answers the storefront's authenticated reads locally.
  if (isDemo() && method === 'GET') {
    const answer = demoStorefront(path)
    if (answer !== undefined) return answer
  }

  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const t = tokens.get()
    if (t) headers.Authorization = `Bearer ${t}`
  }

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })

    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (fallback !== undefined && res.status >= 500) return fallback
      throw new ApiError(payload.message || 'Something went wrong.', res.status, payload)
    }
    return payload.data ?? payload
  } catch (err) {
    // Network failure, not an API error: fall back where one was offered.
    if (err instanceof ApiError) throw err
    if (fallback !== undefined) return fallback
    throw new ApiError('Cannot reach the store right now. Check your connection.', 0)
  }
}

export const api = {
  // ---- storefront
  settings: (fallback) => request('/settings', { fallback }),
  products: (query = '', fallback) => request(`/products${query}`, { fallback }),
  product: (slug, fallback) => request(`/products/${slug}`, { fallback }),
  faqs: (fallback) => request('/faqs', { fallback }),

  // ---- auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me', { auth: true }),
  updateProfile: (body) => request('/auth/me', { method: 'PATCH', body, auth: true }),

  // ---- referral
  trackReferral: (code, body) => request(`/referral/track/${code}`, { method: 'POST', body }),
  referralPreview: (code) => request(`/referral/preview/${code}`),
  myReferrals: () => request('/referral/me', { auth: true }),

  // ---- wallet
  wallet: () => request('/wallet', { auth: true }),
  walletHistory: () => request('/wallet/history', { auth: true }),

  // ---- event sampling
  eventConfig: (fallback) => request('/events/config', { fallback }),
  eventSignup: (body) => request('/events/signup', { method: 'POST', body }),

  // ---- payments
  paymentMethods: (fallback) => request('/payments/methods', { fallback }),
  razorpayOrder: (body) => request('/payments/razorpay/order', { method: 'POST', body, auth: true }),
  razorpayVerify: (body) => request('/payments/razorpay/verify', { method: 'POST', body, auth: true }),


  // ---- cart + checkout
  cart: () => request('/cart', { auth: true }),
  addToCart: (body) => request('/cart/items', { method: 'POST', body, auth: true }),
  quote: (body) => request('/checkout/quote', { method: 'POST', body, auth: true }),
  placeOrder: (body) => request('/checkout/place', { method: 'POST', body, auth: true }),
  myOrders: () => request('/orders', { auth: true }),
}

/**
 * Like request(), but hands back the whole envelope rather than just
 * `data`. Needed where a response carries siblings such as `stats` or
 * `tally` that would otherwise be discarded.
 */
export async function requestRaw(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(tokens.get() ? { Authorization: `Bearer ${tokens.get()}` } : {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(payload.message || 'Something went wrong.', res.status, payload)
  return payload
}

/**
 * Upload a file to the media library.
 *
 * request() always sends JSON, so multipart goes direct. The browser must
 * set its own Content-Type here -- it carries the multipart boundary, and
 * overriding it makes the request unparseable on the server.
 */
export async function uploadMedia(file, { alt = '', folder = 'uploads' } = {}) {
  const form = new FormData()
  form.append('file', file)
  form.append('alt', alt)
  form.append('folder', folder)

  const res = await fetch(`${BASE}/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.get()}` },
    body: form,
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(payload.message || 'That upload failed.', res.status, payload)
  return payload.data ?? payload
}

/** The anonymous id that ties a referral click to a later signup. */
export function visitorToken() {
  let t = localStorage.getItem('zion.visitor')
  if (!t) {
    t = crypto.randomUUID()
    localStorage.setItem('zion.visitor', t)
  }
  return t
}
