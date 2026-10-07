import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { api, tokens, visitorToken } from '../lib/api'
import { PRODUCTS } from '../data/catalog'

/* ===================================================================== */
/* Settings + live theme                                                 */
/* ===================================================================== */
const SettingsCtx = createContext(null)

const FALLBACK_SETTINGS = {
  'store.name': 'ZION Herbs',
  'store.tagline': 'Six Nature. One Wellness.',
  'store.phone': '+91 63840 13131',
  'store.whatsapp': '916384013131',
  'store.email': 'hello@zionherbs.in',
  'store.currency_symbol': '₹',
  'store.free_shipping_over': 999,
  'store.shipping_flat': 69,
  'store.announcement': 'Free delivery across India on orders over ₹999',
  'wallet.coin_name': 'ZION Coins',
  'wallet.coins_per_rupee': 10,
  'wallet.min_redeem_points': 500,
  'wallet.max_redeem_percent': 25,
  'referral.referee_min_order': 499,
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK_SETTINGS)
  const [theme, setTheme] = useState(null)

  useEffect(() => {
    api
      .settings({ settings: FALLBACK_SETTINGS, theme: null })
      .then((res) => {
        if (res?.settings) setSettings({ ...FALLBACK_SETTINGS, ...res.settings })
        if (res?.theme) setTheme(res.theme)
      })
      .catch(() => {})
  }, [])

  // The admin Design Studio publishes token values; we write them straight
  // onto :root so a restyle needs no rebuild and no redeploy.
  useEffect(() => {
    if (!theme?.tokens) return
    const root = document.documentElement
    const { color = {}, font = {}, scale = {} } = theme.tokens
    const map = {
      paper: '--c-paper',
      surface: '--c-surface',
      ink: '--c-ink',
      soft: '--c-soft',
      line: '--c-line',
      gold: '--c-gold',
      'gold-lit': '--c-gold-lit',
    }
    Object.entries(color).forEach(([k, hex]) => {
      const prop = map[k]
      if (!prop || typeof hex !== 'string') return
      const h = hex.replace('#', '')
      if (h.length !== 6) return
      root.style.setProperty(prop, [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' '))
    })
    if (font.display) root.style.setProperty('--f-display', font.display)
    if (font.body) root.style.setProperty('--f-body', font.body)
    if (font.script) root.style.setProperty('--f-script', font.script)
    if (scale.radius) root.style.setProperty('--r-base', scale.radius)
    if (scale.maxWidth) root.style.setProperty('--w-shell', scale.maxWidth)
  }, [theme])

  const value = useMemo(
    () => ({
      settings,
      theme,
      get: (key, dflt) => settings[key] ?? dflt,
    }),
    [settings, theme]
  )

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>
}

export const useSettings = () => useContext(SettingsCtx)

/* ===================================================================== */
/* Auth                                                                  */
/* ===================================================================== */
const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!tokens.get()) return setReady(true)
    api
      .me()
      .then(setUser)
      .catch(() => tokens.clear())
      .finally(() => setReady(true))
  }, [])

  const login = async (email, password) => {
    const res = await api.login({ email, password })
    tokens.set(res)
    setUser(res.user)
    return res.user
  }

  const register = async (payload) => {
    const res = await api.register({
      ...payload,
      referral_code: localStorage.getItem('zion.ref') || undefined,
      visitor_token: visitorToken(),
    })
    tokens.set(res)
    setUser(res.user)
    localStorage.removeItem('zion.ref')
    return res
  }

  const logout = () => {
    tokens.clear()
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)

/* ===================================================================== */
/* Cart -- local first, so a guest can fill a bag without an account.    */
/* ===================================================================== */
const CartCtx = createContext(null)
const CART_KEY = 'zion.cart'

function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const i = state.findIndex((l) => l.sku === action.line.sku)
      if (i > -1) {
        const next = [...state]
        next[i] = { ...next[i], qty: next[i].qty + (action.line.qty || 1) }
        return next
      }
      return [...state, { ...action.line, qty: action.line.qty || 1 }]
    }
    case 'qty':
      return state
        .map((l) => (l.sku === action.sku ? { ...l, qty: Math.max(0, action.qty) } : l))
        .filter((l) => l.qty > 0)
    case 'remove':
      return state.filter((l) => l.sku !== action.sku)
    case 'clear':
      return []
    case 'hydrate':
      return action.lines
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [lines, dispatch] = useReducer(cartReducer, [])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
      if (Array.isArray(saved) && saved.length) dispatch({ type: 'hydrate', lines: saved })
    } catch {
      /* a corrupt cart is not worth crashing the shop over */
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(lines))
  }, [lines])

  const add = (product, size, qty = 1) => {
    dispatch({
      type: 'add',
      line: {
        sku: size.sku,
        slug: product.slug,
        name: product.name,
        label: size.label,
        price: size.price,
        image: product.image || product.hero_image,
        accent: product.accent || product.accent_color,
        qty,
      },
    })
    setOpen(true)
  }

  const count = lines.reduce((n, l) => n + l.qty, 0)
  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0)

  return (
    <CartCtx.Provider
      value={{
        lines,
        count,
        subtotal,
        open,
        setOpen,
        add,
        setQty: (sku, qty) => dispatch({ type: 'qty', sku, qty }),
        remove: (sku) => dispatch({ type: 'remove', sku }),
        clear: () => dispatch({ type: 'clear' }),
      }}
    >
      {children}
    </CartCtx.Provider>
  )
}

export const useCart = () => useContext(CartCtx)

/* ===================================================================== */
/* Catalogue                                                             */
/* ===================================================================== */
const CatalogCtx = createContext(null)

export function CatalogProvider({ children }) {
  const [products, setProducts] = useState(PRODUCTS)

  useEffect(() => {
    api
      .products('', null)
      .then((res) => {
        const list = res?.products || res
        if (Array.isArray(list) && list.length) setProducts(list)
      })
      .catch(() => {})
  }, [])

  return <CatalogCtx.Provider value={{ products }}>{children}</CatalogCtx.Provider>
}

export const useCatalog = () => useContext(CatalogCtx)

/* ===================================================================== */
export function StoreProvider({ children }) {
  return (
    <SettingsProvider>
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>{children}</CartProvider>
        </CatalogProvider>
      </AuthProvider>
    </SettingsProvider>
  )
}
