import { request, requestRaw } from '../lib/api'
import { demoResolve, isDemo } from '../data/demo'

const auth = { auth: true }

/**
 * In demo mode every admin call is answered from fixtures instead of the
 * network, and writes throw a plain "read-only" error the screens already
 * surface as a toast. Outside demo mode this is a no-op passthrough.
 */
const call = (path, opts = {}) => {
  if (isDemo()) {
    const answer = demoResolve(path, opts.method || 'GET')
    if (answer !== undefined) return Promise.resolve(answer)
  }
  return request(path, opts)
}

export const adminApi = {
  dashboard: () => call('/admin/dashboard', auth),

  // generic CRUD over the whitelisted tables
  list: (table, query = '') => call(`/admin/${table}${query}`, auth),
  create: (table, body) => call(`/admin/${table}`, { ...auth, method: 'POST', body }),
  update: (table, id, body) => call(`/admin/${table}/${id}`, { ...auth, method: 'PATCH', body }),
  remove: (table, id) => call(`/admin/${table}/${id}`, { ...auth, method: 'DELETE' }),

  // settings
  settings: () => call('/admin/settings/all', auth),
  saveSettings: (settings) => call('/admin/settings', { ...auth, method: 'PUT', body: { settings } }),

  // theme
  activateTheme: (id) => call(`/admin/theme/${id}/activate`, { ...auth, method: 'POST' }),

  // orders
  orders: (query = '') => call(`/admin/orders${query}`, auth),
  order: (id) => call(`/admin/orders/${id}`, auth),
  updateOrder: (id, body) => call(`/admin/orders/${id}`, { ...auth, method: 'PATCH', body }),

  // customers
  customers: (query = '') => call(`/admin/customers${query}`, auth),
  updateCustomer: (id, body) => call(`/admin/customers/${id}`, { ...auth, method: 'PATCH', body }),
  adjustWallet: (id, body) => call(`/admin/customers/${id}/wallet`, { ...auth, method: 'POST', body }),

  // referrals
  referrals: (query = '') => call(`/admin/referrals${query}`, auth),
  approveReferral: (id) => call(`/admin/referrals/${id}/approve`, { ...auth, method: 'POST' }),
  rejectReferral: (id, reason) =>
    call(`/admin/referrals/${id}/reject`, { ...auth, method: 'POST', body: { reason } }),
  processDue: () => call('/admin/referrals/process-due', { ...auth, method: 'POST' }),

  // media library
  media: (query = '') => call(`/admin/media${query}`, auth),
  deleteMedia: (id) => call(`/admin/media/${id}`, { ...auth, method: 'DELETE' }),

  // event sampling. The list carries stats and tally alongside the rows,
  // so it is read from the full envelope rather than just `data`.
  eventSignups: async (query = '') => {
    if (isDemo()) {
      const answer = demoResolve(`/admin/event_signups${query}`, 'GET')
      if (answer !== undefined) return answer
    }
    const res = await requestRaw(`/events/admin/signups${query}`)
    return { rows: res.data || [], stats: res.stats || null, tally: res.tally || [] }
  },
  claimSignup: (id) => call(`/events/admin/signups/${id}/claim`, { ...auth, method: 'POST' }),
  unclaimSignup: (id) => call(`/events/admin/signups/${id}/unclaim`, { ...auth, method: 'POST' }),
  lookupSignup: (code) => call(`/events/admin/lookup/${encodeURIComponent(code)}`, auth),

  messages: () => call('/admin/messages', auth),
  audit: () => call('/admin/audit', auth),
}
