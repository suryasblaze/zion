/**
 * Demo mode.
 *
 * Lets anyone sign in and walk the whole admin panel with no API and no
 * database behind it. The screens are the real ones — same components,
 * same schemas — only the data is canned and writes are refused.
 *
 * Turned on from the sign-in page. Stored in localStorage so a refresh
 * keeps you in it. Nothing here is imported by the storefront's normal
 * paths, so it costs the real app nothing but the fixtures' bytes.
 */

const KEY = 'zion.demo'

export const isDemo = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const enableDemo = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private browsing — demo just will not persist */
  }
}

export const disableDemo = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clean up */
  }
}

export const DEMO_USER = {
  id: 'demo-admin',
  email: 'demo@zionherbs.in',
  full_name: 'Demo Admin',
  phone: '+91 63840 13131',
  role: 'admin',
  referral_code: 'DEMO-A7K2M',
  wallet_balance: 1250,
  is_active: true,
  created_at: '2026-01-14T09:00:00Z',
}

/* ------------------------------------------------------------------ */
/* Helpers for believable dates                                        */
/* ------------------------------------------------------------------ */
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString()

const DAILY = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(Date.now() - (29 - i) * 864e5)
  // A weekend dip and a slow climb, so the chart reads like a real shop.
  const weekend = [0, 6].includes(day.getDay()) ? 0.55 : 1
  const trend = 0.6 + i / 40
  const wobble = [1, 0.8, 1.25, 0.9, 1.1, 0.75, 1.3][i % 7]
  const revenue = Math.round(1800 * weekend * trend * wobble)
  return {
    day: day.toISOString().slice(0, 10),
    orders: Math.max(0, Math.round(revenue / 950)),
    revenue,
  }
})

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */
const ORDERS = [
  ['ZION-2609-40218', 'Meera Rajan', 'meera.rajan@gmail.com', 2, 1798, 'delivered', 'paid', 'razorpay', 'PRIYA-K7M2Q', 180, 0, 0, 1],
  ['ZION-2609-40217', 'Karthik S', 'karthik.s@outlook.com', 1, 449, 'shipped', 'paid', 'razorpay', null, 0, 500, 50, 2],
  ['ZION-2609-40216', 'Anitha Kumar', 'anitha.k@gmail.com', 3, 1499, 'packed', 'paid', 'cod', null, 0, 0, 0, 2],
  ['ZION-2609-40215', 'Ravi Chandran', 'ravi.c@yahoo.in', 1, 349, 'pending', 'unpaid', 'cod', 'MEERA-9T4XB', 35, 0, 0, 3],
  ['ZION-2609-40214', 'Lakshmi V', 'lakshmi.v@gmail.com', 2, 1099, 'delivered', 'paid', 'razorpay', null, 0, 1000, 100, 4],
  ['ZION-2609-40213', 'Suresh Babu', 'suresh@company.co.in', 4, 2246, 'pending', 'unpaid', 'whatsapp', null, 0, 0, 0, 5],
  ['ZION-2609-40212', 'Divya Menon', 'divya.menon@gmail.com', 1, 299, 'delivered', 'paid', 'cod', 'PRIYA-K7M2Q', 30, 0, 0, 6],
  ['ZION-2609-40211', 'Arjun Nair', 'arjun.nair@gmail.com', 2, 1348, 'cancelled', 'refunded', 'razorpay', null, 0, 0, 0, 8],
].map(([order_number, full_name, email, item_count, total, status, payment_status,
        payment_method, referral_code_used, referral_discount, coins_redeemed, coins_value, ago], i) => ({
  id: `demo-order-${i}`,
  order_number, full_name, email, item_count, total,
  status, payment_status, payment_method, referral_code_used,
  referral_discount, coins_redeemed, coins_value,
  subtotal: total + referral_discount + coins_value,
  coupon_discount: 0, coupon_code: null, shipping_fee: total >= 999 ? 0 : 69,
  tax: Math.round(total * 0.05),
  phone: '+91 98400 12345',
  placed_at: daysAgo(ago),
  tracking_number: ['delivered', 'shipped'].includes(status) ? `TN${41200000 + i * 137}` : null,
  shipping_address: {
    full_name, line1: '14 Kasturba Nagar', line2: 'Adyar',
    city: 'Chennai', state: 'Tamil Nadu', pincode: '600020', phone: '+91 98400 12345',
  },
}))

const ORDER_ITEMS = {
  'demo-order-0': [
    { id: 'i1', product_name: 'Chamomile', variant_label: '100 g', quantity: 1, unit_price: 399, line_total: 399, image_url: '/products/chamomile-tile.jpg' },
    { id: 'i2', product_name: 'Lavender', variant_label: '250 g', quantity: 1, unit_price: 999, line_total: 999, image_url: '/products/lavender-tile.jpg' },
  ],
}

const PRODUCTS = [
  ['Butterfly Pea', 'butterfly-pea', 'Clitoria ternatea', '#2B3F8C', true, true, 1],
  ['Hibiscus', 'hibiscus', 'Hibiscus sabdariffa', '#9E1B32', true, true, 2],
  ['Chamomile', 'chamomile', 'Matricaria chamomilla', '#D9A21B', true, true, 3],
  ['Lavender', 'lavender', 'Lavandula angustifolia', '#6B4E9B', true, true, 4],
  ['Nannari', 'nannari', 'Hemidesmus indicus', '#8A4B24', true, true, 5],
  ['Aavaram Poo', 'aavaram-poo', 'Senna auriculata', '#E0B01F', true, true, 6],
  ['The Six Discovery Box', 'the-six-discovery-box', null, '#8F7222', true, true, 7],
  ['The Calm Trio', 'the-calm-trio', null, '#6B4E9B', false, true, 8],
].map(([name, slug, botanical_name, accent_color, is_featured, is_active, sort_order], i) => ({
  id: `demo-product-${i}`,
  name, slug, botanical_name, accent_color, is_featured, is_active, sort_order,
  accent_soft: accent_color,
  tagline: '', short_desc: '', description: '', story: '',
  hero_image: `/products/${slug}.jpg`,
  benefits: [], ingredients: [], badges: [], brewing: {}, seo: {},
  is_caffeine_free: true,
}))

const VARIANTS = [
  ['ZH-BP-100', '100 g', 349, 399, 120, 0], ['ZH-BP-250', '250 g', 749, 899, 60, 0],
  ['ZH-HB-100', '100 g', 299, 349, 140, 1], ['ZH-HB-250', '250 g', 649, 799, 70, 1],
  ['ZH-CM-100', '100 g', 399, 449, 8, 2], ['ZH-CM-250', '250 g', 899, 1049, 45, 2],
  ['ZH-LV-100', '100 g', 449, 529, 3, 3], ['ZH-LV-250', '250 g', 999, 1199, 35, 3],
  ['ZH-NN-100', '100 g', 279, 329, 150, 4], ['ZH-NN-250', '250 g', 599, 729, 75, 4],
  ['ZH-AP-100', '100 g', 299, 349, 130, 5], ['ZH-AP-250', '250 g', 649, 799, 65, 5],
  ['ZH-SET-SIX', '6 × 50 g', 1499, 1899, 40, 6],
  ['ZH-SET-CALM', '3 × 100 g', 1099, 1297, 0, 7],
].map(([sku, label, price, compare_at_price, stock, pi], i) => ({
  id: `demo-variant-${i}`,
  product_id: `demo-product-${pi}`,
  sku, label, price, compare_at_price, stock,
  low_stock_at: 5, is_active: true, is_default: label.includes('100 g') || sku.startsWith('ZH-SET'),
  sort_order: i, weight_grams: 100,
}))

const CUSTOMERS = [
  ['Priya Krishnan', 'priya.k@gmail.com', 'PRIYA-K7M2Q', 2400, 6, 8994, 4, null, 12],
  ['Meera Rajan', 'meera.rajan@gmail.com', 'MEERA-9T4XB', 1200, 4, 5196, 2, 'Priya Krishnan', 24],
  ['Karthik S', 'karthik.s@outlook.com', 'KARTH-3P8WD', 0, 3, 2247, 0, null, 31],
  ['Anitha Kumar', 'anitha.k@gmail.com', 'ANITH-6M2QZ', 350, 2, 2998, 1, 'Priya Krishnan', 45],
  ['Ravi Chandran', 'ravi.c@yahoo.in', 'RAVIC-8K4TN', 100, 1, 349, 0, 'Meera Rajan', 3],
  ['Lakshmi V', 'lakshmi.v@gmail.com', 'LAKSH-2W7YR', 800, 3, 3297, 1, null, 58],
  ['Divya Menon', 'divya.menon@gmail.com', 'DIVYA-5N9HK', 100, 1, 299, 0, 'Priya Krishnan', 6],
  ['Suresh Babu', 'suresh@company.co.in', 'SURES-4J6VP', 0, 0, 0, 0, null, 2],
].map(([full_name, email, referral_code, wallet_balance, orders, spent, referrals, referred_by_name, ago], i) => ({
  id: `demo-customer-${i}`,
  full_name, email, referral_code, wallet_balance, orders, spent, referrals, referred_by_name,
  phone: '+91 98400 12345',
  is_active: i !== 7,
  created_at: daysAgo(ago),
  last_login_at: daysAgo(Math.floor(ago / 3)),
}))

const REFERRALS = [
  ['Priya Krishnan', 'Meera Rajan', 'PRIYA-K7M2Q', 'rewarded', 200, [], 'ZION-2609-40218', 1798, 24],
  ['Priya Krishnan', 'Divya Menon', 'PRIYA-K7M2Q', 'rewarded', 200, [], 'ZION-2609-40212', 299, 6],
  ['Meera Rajan', 'Ravi Chandran', 'MEERA-9T4XB', 'pending', 0, [], null, null, 3],
  ['Priya Krishnan', 'Anitha Kumar', 'PRIYA-K7M2Q', 'qualified', 0, ['same_ip_as_referrer'], 'ZION-2609-40216', 1499, 2],
  ['Lakshmi V', 'Suresh Babu', 'LAKSH-2W7YR', 'qualified', 0, ['same_device_as_referrer', 'same_email_root'], 'ZION-2609-40213', 2246, 2],
  ['Karthik S', 'Arjun Nair', 'KARTH-3P8WD', 'reversed', 200, [], 'ZION-2609-40211', 1348, 8],
].map(([referrer_name, referee_name, code, status, referrer_points_awarded, fraud_flags,
        order_number, order_total, ago], i) => ({
  id: `demo-referral-${i}`,
  referrer_name, referee_name, code, status, referrer_points_awarded, fraud_flags,
  order_number, order_total,
  referrer_email: 'referrer@example.com',
  referee_email: 'friend@example.com',
  qualifying_order_id: order_number ? `demo-order-${i}` : null,
  referee_discount_type: 'percent',
  referee_discount_value: 10,
  referrer_points_config: 200,
  referee_points_awarded: 100,
  rejected_reason: status === 'reversed' ? 'Order cancelled or refunded' : null,
  created_at: daysAgo(ago),
  rewarded_at: status === 'rewarded' ? daysAgo(ago - 1) : null,
}))

const FAQS = [
  ['Are ZION herbal teas caffeine free?', 'Yes. All six ZION infusions are completely caffeine free. None of them contain any Camellia sinensis, so there is no caffeine at any stage.', 'product', 1],
  ['What is aavaram poo and what is it used for?', 'Aavaram poo is the flower of Senna auriculata, a shrub that grows across the drier districts of Tamil Nadu. In Siddha medicine it has been used for generations to support blood sugar balance, digestion and skin health.', 'ingredients', 2],
  ['What is nannari?', 'Nannari is the root of Hemidesmus indicus, also called Indian sarsaparilla. It is a traditional Tamil body coolant, most familiar as nannari sherbet drunk in summer.', 'ingredients', 3],
  ['Why does butterfly pea tea turn purple?', 'Butterfly pea flowers contain anthocyanins, pigments that change colour with acidity. Adding lime shifts the tea from blue to violet within seconds.', 'product', 4],
  ['How much tea do I get in a 100 g pack?', 'Roughly 40 to 50 cups, depending on the tea. Flowers such as chamomile go a long way; nannari root is denser.', 'product', 5],
  ['Do you ship across India?', 'Yes, to every serviceable pincode, from our unit in Tamil Nadu. Free over ₹999, ₹69 below that.', 'shipping', 6],
  ['How does the ZION referral programme work?', 'Every account gets a personal referral link. When a friend signs up through it and completes their first order, they get a discount and you get ZION Coins.', 'referral', 7],
  ['Are these teas safe during pregnancy or with medication?', 'Herbal infusions are food, not medicine, and we make no medical claims. If you are pregnant, breastfeeding or on medication, ask your doctor first.', 'safety', 8],
].map(([question, answer, category, sort_order], i) => ({
  id: `demo-faq-${i}`, question, answer, category, sort_order,
  scope: 'global', is_active: true, product_id: null,
}))

const SETTINGS = {
  referral: [
    ['referral.enabled', true, 'toggle', 'Referral programme is live', 'Master switch. Turning this off hides referral links and stops new rewards; already-earned points are untouched.'],
    ['referral.referee_discount_type', 'percent', 'select', 'Discount type for the friend', 'Percent of order value, or a flat rupee amount off.', [{ label: 'Percentage off', value: 'percent' }, { label: 'Flat amount off', value: 'fixed' }]],
    ['referral.referee_discount_value', 10, 'number', 'Discount for the friend', 'What the referred person gets on their first order.'],
    ['referral.referee_discount_max', 300, 'number', "Cap on the friend's discount", 'Upper limit in rupees when the discount is a percentage. 0 removes the cap.'],
    ['referral.referee_min_order', 499, 'number', 'Minimum order to use the referral discount', 'Order subtotal must reach this before the referral discount applies.'],
    ['referral.referrer_points', 200, 'number', 'Points for the referrer', "Credited to the referrer's wallet once their friend's first order qualifies."],
    ['referral.referee_welcome_points', 100, 'number', 'Welcome points for the friend', 'Credited to the new customer when they sign up through a referral link.'],
    ['referral.qualify_on', 'order_paid', 'select', 'When a referral counts', 'Pay the referrer as soon as the first order is paid, or hold until it is delivered.', [{ label: 'Order is paid', value: 'order_paid' }, { label: 'Order is delivered', value: 'order_delivered' }]],
    ['referral.reward_hold_days', 0, 'number', 'Hold reward for (days)', 'Delay before points become spendable, to cover the returns window.'],
    ['referral.max_rewards_per_user', 0, 'number', 'Maximum rewarded referrals per person', 'Caps how many friends one account can be paid for. 0 means unlimited.'],
    ['referral.cookie_days', 30, 'number', 'Referral link lasts (days)', 'How long after clicking a link a signup is still credited to the referrer.'],
    ['referral.block_same_ip', true, 'toggle', "Flag signups from the referrer's own network", 'Marks a referral for review when referrer and friend share an IP.'],
    ['referral.block_same_device', true, 'toggle', "Flag signups from the referrer's own device", "Marks a referral for review when the browser fingerprint matches the referrer's."],
    ['referral.auto_approve_flagged', false, 'toggle', 'Pay flagged referrals automatically', 'Off means a flagged referral waits in Referrals > Review before any points move.'],
    ['referral.share_message', 'I have been drinking ZION herbal teas - caffeine-free, made in Tamil Nadu. Use my link for {discount} off your first order.', 'textarea', 'Default share message', '{discount}, {code} and {name} are replaced automatically.'],
  ],
  wallet: [
    ['wallet.enabled', true, 'toggle', 'Wallet is live', 'Lets customers hold and spend points.'],
    ['wallet.coin_name', 'ZION Coins', 'text', 'What points are called', 'Shown everywhere on the storefront.'],
    ['wallet.coins_per_rupee', 10, 'number', 'Coins per ₹1', 'The redemption rate. 10 means 10 coins are worth one rupee, so 2,000 coins is ₹200 off.'],
    ['wallet.min_redeem_points', 500, 'number', 'Minimum coins per redemption', 'Customers must have at least this many before they can spend any.'],
    ['wallet.max_redeem_percent', 25, 'number', 'Most of an order payable in coins (%)', 'Stops a whole order being paid in points.'],
    ['wallet.points_expiry_days', 365, 'number', 'Points expire after (days)', '0 means points never expire.'],
  ],
  store: [
    ['store.name', 'ZION Herbs', 'text', 'Store name'],
    ['store.tagline', 'Six Nature. One Wellness.', 'text', 'Tagline'],
    ['store.email', 'hello@zionherbs.in', 'text', 'Contact email'],
    ['store.phone', '+91 63840 13131', 'text', 'Phone'],
    ['store.whatsapp', '916384013131', 'text', 'WhatsApp number', 'Digits only, with country code. Powers the WhatsApp order button.'],
    ['store.free_shipping_over', 999, 'number', 'Free shipping above', 'Order subtotal that earns free delivery.'],
    ['store.shipping_flat', 69, 'number', 'Flat shipping fee'],
    ['store.tax_percent', 5, 'number', 'GST (%)', 'Applied to the taxable amount after discounts.'],
    ['store.cod_enabled', true, 'toggle', 'Cash on delivery'],
    ['store.razorpay_enabled', false, 'toggle', 'Razorpay checkout', 'Needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.'],
    ['store.whatsapp_order_enabled', true, 'toggle', 'WhatsApp ordering'],
    ['store.announcement', 'Free delivery across India on orders over ₹999', 'text', 'Announcement bar', 'Leave empty to hide the bar.'],
  ],
  seo: [
    ['seo.site_url', 'https://zionherbs.in', 'text', 'Canonical site URL'],
    ['seo.default_title', 'ZION Herbs — Caffeine-Free Herbal Teas from Tamil Nadu', 'text', 'Default page title'],
    ['seo.default_description', 'Six single-origin herbal infusions — butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo. Caffeine-free, no artificial flavours, hand-packed in Tamil Nadu.', 'textarea', 'Default meta description', 'Aim for 150–160 characters.'],
    ['seo.og_image', '/brand/range-poster-dark.jpg', 'text', 'Default social image'],
    ['seo.twitter_handle', '@zionherbs', 'text', 'X / Twitter handle'],
    ['seo.google_verification', '', 'text', 'Google Search Console token'],
    ['seo.ga_measurement_id', '', 'text', 'Google Analytics ID', 'e.g. G-XXXXXXX'],
    ['seo.ai_crawlers_allowed', true, 'toggle', 'Allow AI crawlers', 'Lets GPTBot, ClaudeBot, PerplexityBot and friends read the site, so it can be cited in AI answers.'],
    ['seo.llms_txt_enabled', true, 'toggle', 'Publish /llms.txt', 'A plain-text brand and product summary written for language models.'],
  ],
}

const settingsGrouped = () => {
  const out = {}
  Object.entries(SETTINGS).forEach(([group, rows]) => {
    out[group] = rows.map(([key, value, ui_control, label, description, options], i) => ({
      key, value, ui_control, label,
      description: description || null,
      options: options || [],
      group_key: group,
      value_type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
      min_value: null, max_value: null,
      is_public: group !== 'referral',
      sort_order: i,
    }))
  })
  return out
}

const THEMES = [
  {
    id: 'demo-theme-1',
    name: 'Paper & Gold',
    slug: 'paper-gold',
    description: 'The house style: warm paper ground, antique gold, and one botanical colour at a time.',
    is_active: true,
    is_system: true,
    tokens: {
      color: {
        paper: '#FCFBF9', surface: '#EEEFE9', ink: '#171310',
        soft: '#5F564B', line: '#E3DFD5', gold: '#8F7222', 'gold-lit': '#C8A44D',
      },
      font: { display: 'Marcellus', body: 'Jost', script: 'Italianno' },
      scale: { radius: '2px', maxWidth: '1240px' },
      motion: { enabled: true, intensity: 'subtle' },
    },
  },
  {
    id: 'demo-theme-2',
    name: 'Lacquer & Gold',
    slug: 'lacquer-gold',
    description: 'The dark alternative: brewed-black ground with foil gold.',
    is_active: false,
    is_system: true,
    tokens: {
      color: {
        paper: '#14100C', surface: '#1E1811', ink: '#F4EDE0',
        soft: '#A2957F', line: '#2E2619', gold: '#C8A44D', 'gold-lit': '#EBD08A',
      },
      font: { display: 'Marcellus', body: 'Jost', script: 'Italianno' },
      scale: { radius: '2px', maxWidth: '1240px' },
      motion: { enabled: true, intensity: 'subtle' },
    },
  },
]

const TABLES = {
  products: PRODUCTS,
  product_variants: VARIANTS,
  categories: [
    { id: 'c1', name: 'Single-origin infusions', slug: 'single-origin', description: 'One botanical, nothing else. Six of them.', sort_order: 1, is_active: true },
    { id: 'c2', name: 'Gift sets', slug: 'gift-sets', description: 'Curated boxes for gifting and for trying the range.', sort_order: 2, is_active: true },
  ],
  faqs: FAQS,
  coupons: [
    { id: 'cp1', code: 'FIRSTSIP', description: 'First-order welcome', discount_type: 'percent', value: 10, min_order: 499, max_discount: 300, usage_limit: null, per_user_limit: 1, used_count: 47, is_active: true },
    { id: 'cp2', code: 'DIWALI200', description: 'Festival campaign', discount_type: 'fixed', value: 200, min_order: 1499, max_discount: null, usage_limit: 500, per_user_limit: 1, used_count: 213, is_active: true },
    { id: 'cp3', code: 'SUMMER15', description: 'Nannari season push', discount_type: 'percent', value: 15, min_order: 799, max_discount: 250, usage_limit: 200, per_user_limit: 1, used_count: 200, is_active: false },
  ],
  nav_items: [
    { id: 'n1', menu: 'header', label: 'Shop', href: '/shop', sort_order: 1, is_active: true },
    { id: 'n2', menu: 'header', label: 'The six', href: '/the-six', sort_order: 2, is_active: true },
    { id: 'n3', menu: 'header', label: 'Our roots', href: '/our-roots', sort_order: 3, is_active: true },
    { id: 'n4', menu: 'header', label: 'Brewing', href: '/brewing', sort_order: 4, is_active: true },
    { id: 'n5', menu: 'header', label: 'Refer & earn', href: '/refer', sort_order: 5, is_active: true },
    { id: 'n6', menu: 'legal', label: 'Shipping', href: '/p/shipping-policy', sort_order: 1, is_active: true },
    { id: 'n7', menu: 'legal', label: 'Privacy', href: '/p/privacy-policy', sort_order: 3, is_active: true },
  ],
  pages: [
    { id: 'pg1', title: 'Shipping policy', slug: 'shipping-policy', page_type: 'legal', is_published: true, excerpt: 'Where we ship, what it costs, how long it takes.' },
    { id: 'pg2', title: 'Returns policy', slug: 'returns-policy', page_type: 'legal', is_published: true, excerpt: 'Unopened tins, within 14 days.' },
    { id: 'pg3', title: 'Privacy policy', slug: 'privacy-policy', page_type: 'legal', is_published: true, excerpt: 'What we store and why.' },
    { id: 'pg4', title: 'Brewing nannari the traditional way', slug: 'nannari-sherbet', page_type: 'journal', is_published: false, excerpt: 'Root, jaggery, lime and patience.' },
  ],
  testimonials: [
    { id: 't1', author: 'Meera Rajan', city: 'Chennai', role: 'Verified buyer', quote: 'The chamomile is the first one I have had that actually smells of chamomile. You can see the whole flowers.', rating: 5, is_active: true, sort_order: 1 },
    { id: 't2', author: 'Karthik S', city: 'Coimbatore', role: 'Verified buyer', quote: 'Bought the nannari expecting nostalgia and got something better. Brews exactly as the card says.', rating: 5, is_active: true, sort_order: 2 },
    { id: 't3', author: 'Lakshmi V', city: 'Madurai', role: 'Verified buyer', quote: 'My mother asked where I got aavaram poo this good. That is the whole review.', rating: 5, is_active: true, sort_order: 3 },
  ],
  reviews: [
    { id: 'r1', author_name: 'Divya Menon', rating: 5, title: 'Turns purple, genuinely', body: 'My daughter will not stop making it. Lovely with lime.', is_approved: true, is_verified: true },
    { id: 'r2', author_name: 'Anonymous', rating: 4, title: 'Good but pricey', body: 'Quality is clear. Wish the 250 g was a bit cheaper.', is_approved: false, is_verified: false },
    { id: 'r3', author_name: 'Ravi C', rating: 5, title: 'Lavender is not soapy', body: 'Followed the 3 minute rule and it is lovely.', is_approved: false, is_verified: true },
  ],
  locations: [
    { id: 'l1', name: 'ZION Herbs', kind: 'hq', city: 'Chennai', state: 'Tamil Nadu', country: 'India', phone: '+91 63840 13131', whatsapp: '916384013131', email: 'hello@zionherbs.in', is_primary: true, is_active: true, service_areas: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'All India'] },
  ],
  redirects: [
    { id: 'rd1', from_path: '/products/blue-tea', to_path: '/product/butterfly-pea', status_code: 301, hits: 84, is_active: true },
    { id: 'rd2', from_path: '/shop/all', to_path: '/shop', status_code: 301, hits: 12, is_active: true },
  ],
  page_sections: [
    { id: 's1', page: 'home', section_key: 'hero', component: 'Hero', title: 'The whole flower. Nothing else in the tin.', sort_order: 1, is_active: true },
    { id: 's2', page: 'home', section_key: 'shelf', component: 'ProductShelf', title: 'Six single-origin infusions', sort_order: 2, is_active: true },
    { id: 's3', page: 'home', section_key: 'roots', component: 'TamilRoots', title: 'Two of these belong to the medicine cabinet', sort_order: 3, is_active: true },
    { id: 's4', page: 'home', section_key: 'referral', component: 'ReferralBlock', title: 'Send a friend a pot, keep the coins', sort_order: 4, is_active: true },
    { id: 's5', page: 'home', section_key: 'faq', component: 'Faq', title: 'Questions we actually get', sort_order: 5, is_active: true },
  ],
  theme_presets: THEMES,
}

const MESSAGES = [
  { id: 'm1', name: 'Sundar R', email: 'sundar.r@gmail.com', phone: '+91 90031 22110', subject: 'Bulk order for corporate gifting', message: 'We need 120 discovery boxes for Diwali. Can you do custom sleeves with our logo, and what would the lead time be?', status: 'new', created_at: daysAgo(1) },
  { id: 'm2', name: 'Fathima N', email: 'fathima@gmail.com', subject: 'Aavaram poo and blood sugar', message: 'My father is diabetic and on metformin. Is aavaram poo safe alongside it?', status: 'new', created_at: daysAgo(2) },
  { id: 'm3', name: 'Vikram Iyer', email: 'vikram.iyer@outlook.com', subject: 'Stockist enquiry — Bangalore', message: 'I run two organic stores in Indiranagar. Do you do wholesale?', status: 'read', created_at: daysAgo(6) },
]

const MEDIA = [
  ['butterfly-pea-tile.jpg', '/products/butterfly-pea-tile.jpg', 'Butterfly pea tea in a ZION cup', 132000],
  ['hibiscus-tile.jpg', '/products/hibiscus-tile.jpg', 'Hibiscus tea in a ZION cup', 129000],
  ['chamomile-tile.jpg', '/products/chamomile-tile.jpg', 'Chamomile tea in a ZION cup', 109000],
  ['lavender-tile.jpg', '/products/lavender-tile.jpg', 'Lavender tea in a ZION cup', 117000],
  ['nannari-tile.jpg', '/products/nannari-tile.jpg', 'Nannari tea in a ZION cup', 134000],
  ['aavaram-poo-tile.jpg', '/products/aavaram-poo-tile.jpg', 'Aavaram poo tea in a ZION cup', 108000],
  ['lavender-tin.jpg', '/products/lavender-tin.jpg', 'The ZION lavender tin', 144000],
  ['range-poster-light.jpg', '/brand/range-poster-light.jpg', 'The six ZION herbal teas', 384000],
].map(([filename, url, alt, size_bytes], i) => ({
  id: `demo-media-${i}`,
  filename, url, alt, size_bytes,
  path: url.replace(/^\//, ''),
  mime_type: 'image/jpeg',
  folder: url.includes('/brand/') ? 'brand' : 'products',
  created_at: daysAgo(20 - i),
}))

const SIGNUPS = [
  ['Meera Rajan', '9840012345', 'Chamomile', 'chamomile', '#D9A21B', 'claimed', 2],
  ['Karthik S', '9840022334', 'Nannari', 'nannari', '#8A4B24', 'pending', 3],
  ['Anitha Kumar', '9840033445', 'Butterfly Pea', 'butterfly-pea', '#2B3F8C', 'claimed', 4],
  ['Ravi Chandran', '9840044556', 'Hibiscus', 'hibiscus', '#9E1B32', 'pending', 5],
  ['Divya Menon', '9840055667', 'Chamomile', 'chamomile', '#D9A21B', 'pending', 6],
  ['Suresh Babu', '9840066778', 'Lavender', 'lavender', '#6B4E9B', 'claimed', 8],
  ['Lakshmi V', '9840077889', 'Butterfly Pea', 'butterfly-pea', '#2B3F8C', 'pending', 9],
  ['Arjun Nair', '9840088990', 'Aavaram Poo', 'aavaram-poo', '#E0B01F', 'pending', 11],
].map(([full_name, phone, product_name, product_slug, accent_color, status, hoursAgo], i) => ({
  id: `demo-signup-${i}`,
  full_name, phone, product_name, product_slug, accent_color, status,
  email: null,
  claim_code: `ZN-${['4K7Q','9M2T','7XPD','3RHN','8VCA','2JLE','6YWF','5QKM'][i]}`,
  event_slug: 'default',
  event_name: 'ZION tasting',
  source: 'link',
  claimed_at: status === 'claimed' ? daysAgo(hoursAgo / 24) : null,
  created_at: daysAgo(hoursAgo / 24),
}))

const SIGNUP_TALLY = Object.values(
  SIGNUPS.reduce((acc, s) => {
    acc[s.product_name] = acc[s.product_name] || {
      product_name: s.product_name, product_slug: s.product_slug,
      accent_color: s.accent_color, signups: 0, claimed: 0,
    }
    acc[s.product_name].signups += 1
    if (s.status === 'claimed') acc[s.product_name].claimed += 1
    return acc
  }, {})
).sort((a, b) => b.signups - a.signups)

const DASHBOARD = {
  stats: {
    orders_30d: 58,
    revenue_30d: DAILY.reduce((n, d) => n + d.revenue, 0),
    revenue_all: 412870,
    pending_orders: 2,
    customers: 8,
    customers_30d: 3,
    referrals_total: 6,
    referrals_paid: 2,
    referrals_flagged: 2,
    coins_outstanding: 4950,
    coins_liability: 495,
    unread_messages: 2,
    pending_reviews: 2,
  },
  low_stock: [
    { sku: 'ZH-SET-CALM', label: '3 × 100 g', stock: 0, low_stock_at: 5, name: 'The Calm Trio', slug: 'the-calm-trio' },
    { sku: 'ZH-LV-100', label: '100 g', stock: 3, low_stock_at: 5, name: 'Lavender', slug: 'lavender' },
    { sku: 'ZH-CM-100', label: '100 g', stock: 8, low_stock_at: 10, name: 'Chamomile', slug: 'chamomile' },
  ],
  recent_orders: ORDERS.slice(0, 8).map((o) => ({
    order_number: o.order_number, email: o.email, total: o.total,
    status: o.status, payment_status: o.payment_status, placed_at: o.placed_at,
  })),
  daily: DAILY,
  top_products: [
    { product_name: 'The Six Discovery Box', units: 34, revenue: 50966 },
    { product_name: 'Chamomile', units: 41, revenue: 16359 },
    { product_name: 'Lavender', units: 28, revenue: 14672 },
    { product_name: 'Nannari', units: 39, revenue: 10881 },
    { product_name: 'Hibiscus', units: 31, revenue: 9269 },
    { product_name: 'Butterfly Pea', units: 22, revenue: 7678 },
  ],
  top_referrers: [
    { full_name: 'Priya Krishnan', email: 'priya.k@gmail.com', referral_code: 'PRIYA-K7M2Q', clicks: 84, signups: 4, conversions: 3, points_earned: 600 },
    { full_name: 'Meera Rajan', email: 'meera.rajan@gmail.com', referral_code: 'MEERA-9T4XB', clicks: 37, signups: 2, conversions: 1, points_earned: 200 },
    { full_name: 'Lakshmi V', email: 'lakshmi.v@gmail.com', referral_code: 'LAKSH-2W7YR', clicks: 19, signups: 1, conversions: 0, points_earned: 0 },
  ],
}

/* ------------------------------------------------------------------ */
/* Resolver                                                            */
/* ------------------------------------------------------------------ */
// request() already unwraps `payload.data`, so demo answers match that shape.
const wrap = (data) => data

/**
 * Answers an admin API path from the fixtures above.
 * Returns undefined for anything it does not know, so the caller can
 * fall through to a real request.
 */
export function demoResolve(path, method = 'GET') {
  const [route, qs] = path.split('?')
  const params = new URLSearchParams(qs || '')

  if (method !== 'GET') {
    // Demo mode is read-only. Say so plainly rather than pretending.
    const err = new Error('Demo mode is read-only — this would have saved on a live shop.')
    err.status = 403
    err.demo = true
    throw err
  }

  if (route === '/admin/dashboard') return DASHBOARD
  if (route === '/admin/settings/all') return settingsGrouped()
  if (route === '/admin/messages') return MESSAGES
  if (route === '/admin/media') return wrap(MEDIA)

  if (route === '/admin/event_signups') {
    const status = params.get('status')
    const q = (params.get('q') || '').toLowerCase()
    let rows = SIGNUPS
    if (status && status !== 'all') rows = rows.filter((r) => r.status === status)
    if (q) {
      rows = rows.filter((r) =>
        (r.full_name + r.phone + r.claim_code).toLowerCase().includes(q)
      )
    }
    return {
      rows,
      stats: {
        total: SIGNUPS.length,
        pending: SIGNUPS.filter((r) => r.status === 'pending').length,
        claimed: SIGNUPS.filter((r) => r.status === 'claimed').length,
        today: SIGNUPS.length,
      },
      tally: SIGNUP_TALLY,
    }
  }
  if (route === '/admin/audit') return []

  if (route === '/admin/orders') {
    const status = params.get('status')
    const q = (params.get('q') || '').toLowerCase()
    let rows = ORDERS
    if (status && status !== 'all') rows = rows.filter((o) => o.status === status)
    if (q) rows = rows.filter((o) => (o.order_number + o.email + o.full_name).toLowerCase().includes(q))
    return wrap(rows)
  }

  if (route.startsWith('/admin/orders/')) {
    const id = route.split('/').pop()
    const order = ORDERS.find((o) => o.id === id)
    return order ? { ...order, items: ORDER_ITEMS[id] || ORDER_ITEMS['demo-order-0'], events: [] } : null
  }

  if (route === '/admin/customers') {
    const q = (params.get('q') || '').toLowerCase()
    const rows = q
      ? CUSTOMERS.filter((c) => (c.full_name + c.email + c.referral_code).toLowerCase().includes(q))
      : CUSTOMERS
    return wrap(rows)
  }

  if (route === '/admin/referrals') {
    const status = params.get('status')
    let rows = REFERRALS
    if (params.get('flagged') === '1') rows = rows.filter((r) => r.fraud_flags.length > 0)
    else if (status && status !== 'all') rows = rows.filter((r) => r.status === status)
    return wrap(rows)
  }

  // Generic collections
  const m = route.match(/^\/admin\/([a-z_]+)$/)
  if (m && TABLES[m[1]]) {
    const q = (params.get('q') || '').toLowerCase()
    let rows = TABLES[m[1]]
    if (q) {
      rows = rows.filter((r) =>
        Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
      )
    }
    return wrap(rows)
  }

  return undefined
}

/** Storefront-side demo answers, for the account and referral pages. */
export function demoStorefront(path) {
  if (path === '/referral/me')
    return {
      code: DEMO_USER.referral_code,
      link: `${window.location.origin}/r/${DEMO_USER.referral_code}`,
      clicks: 84, signups: 4, conversions: 3, points_earned: 600,
      signup_rate_pct: 4.76,
      discount_label: '10% off',
      reward_points: 200,
      share_message: 'I have been drinking ZION herbal teas — caffeine-free, made in Tamil Nadu. Use my link for 10% off your first order.',
      enabled: true,
      referrals: REFERRALS.slice(0, 4).map((r) => ({
        id: r.id, status: r.status, created_at: r.created_at,
        joined_at: r.created_at, full_name: r.referee_name,
        referrer_points_awarded: r.referrer_points_awarded,
        fraud_flags: r.fraud_flags,
      })),
    }

  if (path === '/wallet')
    return {
      balance: 1250, value: 125, lifetime_earned: 1600, lifetime_spent: 350,
      coin_name: 'ZION Coins', coins_per_rupee: 10,
      min_redeem_points: 500, max_redeem_percent: 25, enabled: true,
    }

  if (path === '/wallet/history')
    return [
      { id: 'w1', type: 'referral_reward', points: 200, balance_after: 1250, note: 'Referral reward', created_at: daysAgo(6) },
      { id: 'w2', type: 'redeem', points: -350, balance_after: 1050, note: 'Redeemed on order ZION-2609-40214', created_at: daysAgo(12) },
      { id: 'w3', type: 'referral_reward', points: 200, balance_after: 1400, note: 'Referral reward', created_at: daysAgo(24) },
      { id: 'w4', type: 'welcome_bonus', points: 100, balance_after: 1200, note: 'Welcome bonus for joining through a friend', created_at: daysAgo(58) },
    ]

  if (path === '/orders')
    return ORDERS.slice(0, 4).map((o) => ({
      ...o,
      items: [{ name: 'Chamomile', label: '100 g', quantity: 1, line_total: 399, image: '/products/chamomile-tile.jpg' }],
    }))

  return undefined
}
