-- =====================================================================
-- ZION Herbs -- seed.sql
-- Safe to re-run: every insert is idempotent on its natural key.
-- Product copy is drawn from the brand's own artwork.
-- =====================================================================

-- =====================================================================
-- ADMIN SETTINGS
-- Every number the referral programme runs on lives here, not in code.
-- =====================================================================
insert into admin_settings
  (key, value, value_type, group_key, label, description, ui_control, options, min_value, max_value, is_public, sort_order)
values

-- ---------- Referral programme -------------------------------------
('referral.enabled', 'true', 'boolean', 'referral',
 'Referral programme is live',
 'Master switch. Turning this off hides referral links and stops new rewards; already-earned points are untouched.',
 'toggle', '[]', null, null, true, 1),

('referral.referee_discount_type', '"percent"', 'string', 'referral',
 'Discount type for the friend',
 'Percent of order value, or a flat rupee amount off.',
 'select', '[{"label":"Percentage off","value":"percent"},{"label":"Flat amount off","value":"fixed"}]',
 null, null, false, 2),

('referral.referee_discount_value', '10', 'number', 'referral',
 'Discount for the friend',
 'What the referred person gets on their first order. Read as a percentage or as rupees depending on the type above.',
 'number', '[]', 0, 100, false, 3),

('referral.referee_discount_max', '300', 'number', 'referral',
 'Cap on the friend''s discount',
 'Upper limit in rupees when the discount is a percentage. 0 removes the cap.',
 'number', '[]', 0, null, false, 4),

('referral.referee_min_order', '499', 'number', 'referral',
 'Minimum order to use the referral discount',
 'Order subtotal must reach this before the referral discount applies.',
 'number', '[]', 0, null, true, 5),

('referral.referrer_points', '200', 'integer', 'referral',
 'Points for the referrer',
 'Credited to the referrer''s wallet once their friend''s first order qualifies.',
 'number', '[]', 0, null, false, 6),

('referral.referee_welcome_points', '100', 'integer', 'referral',
 'Welcome points for the friend',
 'Credited to the new customer when they sign up through a referral link. Set to 0 to disable.',
 'number', '[]', 0, null, false, 7),

('referral.qualify_on', '"order_paid"', 'string', 'referral',
 'When a referral counts',
 'Pay the referrer as soon as the first order is paid, or hold until it is delivered.',
 'select', '[{"label":"Order is paid","value":"order_paid"},{"label":"Order is delivered","value":"order_delivered"}]',
 null, null, false, 8),

('referral.reward_hold_days', '0', 'integer', 'referral',
 'Hold reward for (days)',
 'Delay before points become spendable, to cover the returns window. 0 credits immediately.',
 'number', '[]', 0, 90, false, 9),

('referral.max_rewards_per_user', '0', 'integer', 'referral',
 'Maximum rewarded referrals per person',
 'Caps how many friends one account can be paid for. 0 means unlimited.',
 'number', '[]', 0, null, false, 10),

('referral.cookie_days', '30', 'integer', 'referral',
 'Referral link lasts (days)',
 'How long after clicking a link a signup is still credited to the referrer.',
 'number', '[]', 1, 365, false, 11),

('referral.block_same_ip', 'true', 'boolean', 'referral',
 'Flag signups from the referrer''s own network',
 'Marks a referral for review when referrer and friend share an IP. Catches the most common self-referral.',
 'toggle', '[]', null, null, false, 12),

('referral.block_same_device', 'true', 'boolean', 'referral',
 'Flag signups from the referrer''s own device',
 'Marks a referral for review when the browser fingerprint matches the referrer''s.',
 'toggle', '[]', null, null, false, 13),

('referral.auto_approve_flagged', 'false', 'boolean', 'referral',
 'Pay flagged referrals automatically',
 'Off means a flagged referral waits in Referrals > Review before any points move.',
 'toggle', '[]', null, null, false, 14),

('referral.share_message',
 '"I have been drinking ZION herbal teas - caffeine-free, made in Tamil Nadu. Use my link for {discount} off your first order."',
 'string', 'referral',
 'Default share message',
 'Used by the share buttons. {discount}, {code} and {name} are replaced automatically.',
 'textarea', '[]', null, null, true, 15),

-- ---------- Wallet -------------------------------------------------
('wallet.enabled', 'true', 'boolean', 'wallet',
 'Wallet is live', 'Lets customers hold and spend points.', 'toggle', '[]', null, null, true, 1),

('wallet.coin_name', '"ZION Coins"', 'string', 'wallet',
 'What points are called', 'Shown everywhere on the storefront.', 'text', '[]', null, null, true, 2),

('wallet.coins_per_rupee', '10', 'number', 'wallet',
 'Coins per ₹1',
 'The redemption rate. 10 means 10 coins are worth one rupee, so 2,000 coins is ₹200 off.',
 'number', '[]', 1, null, true, 3),

('wallet.min_redeem_points', '500', 'integer', 'wallet',
 'Minimum coins per redemption',
 'Customers must have at least this many before they can spend any.',
 'number', '[]', 0, null, true, 4),

('wallet.max_redeem_percent', '25', 'number', 'wallet',
 'Most of an order payable in coins (%)',
 'Stops a whole order being paid in points. 25 means coins can cover at most a quarter of the subtotal.',
 'number', '[]', 0, 100, true, 5),

('wallet.points_expiry_days', '365', 'integer', 'wallet',
 'Points expire after (days)', '0 means points never expire.',
 'number', '[]', 0, null, true, 6),

-- ---------- Store --------------------------------------------------
('store.name', '"ZION Herbs"', 'string', 'store', 'Store name', null, 'text', '[]', null, null, true, 1),
('store.tagline', '"Six Nature. One Wellness."', 'string', 'store', 'Tagline', null, 'text', '[]', null, null, true, 2),
('store.email', '"hello@zionherbs.in"', 'string', 'store', 'Contact email', null, 'text', '[]', null, null, true, 3),
('store.phone', '"+91 63840 13131"', 'string', 'store', 'Phone', null, 'text', '[]', null, null, true, 4),
('store.whatsapp', '"916384013131"', 'string', 'store', 'WhatsApp number',
 'Digits only, with country code. Powers the WhatsApp order button.', 'text', '[]', null, null, true, 5),
('store.currency', '"INR"', 'string', 'store', 'Currency', null, 'text', '[]', null, null, true, 6),
('store.currency_symbol', '"₹"', 'string', 'store', 'Currency symbol', null, 'text', '[]', null, null, true, 7),
('store.free_shipping_over', '999', 'number', 'store', 'Free shipping above',
 'Order subtotal that earns free delivery.', 'number', '[]', 0, null, true, 8),
('store.shipping_flat', '69', 'number', 'store', 'Flat shipping fee', null, 'number', '[]', 0, null, true, 9),
('store.tax_percent', '5', 'number', 'store', 'GST (%)',
 'Applied to the taxable amount after discounts.', 'number', '[]', 0, 100, true, 10),
('store.cod_enabled', 'true', 'boolean', 'store', 'Cash on delivery', null, 'toggle', '[]', null, null, true, 11),
('store.razorpay_enabled', 'false', 'boolean', 'store', 'Razorpay checkout',
 'Needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.', 'toggle', '[]', null, null, true, 12),
('store.whatsapp_order_enabled', 'true', 'boolean', 'store', 'WhatsApp ordering',
 'Shows a "Order on WhatsApp" path alongside checkout.', 'toggle', '[]', null, null, true, 13),
('store.announcement', '"Free delivery across India on orders over ₹999"', 'string', 'store',
 'Announcement bar', 'Leave empty to hide the bar.', 'text', '[]', null, null, true, 14),

-- ---------- SEO / AEO / GEO ----------------------------------------
('seo.site_url', '"https://zionherbs.in"', 'string', 'seo', 'Canonical site URL', null, 'text', '[]', null, null, true, 1),
('seo.default_title', '"ZION Herbs — Caffeine-Free Herbal Teas from Tamil Nadu"', 'string', 'seo',
 'Default page title', null, 'text', '[]', null, null, true, 2),
('seo.default_description',
 '"Six single-origin herbal infusions — butterfly pea, hibiscus, chamomile, lavender, nannari and aavaram poo. Caffeine-free, no artificial flavours, hand-packed in Tamil Nadu."',
 'string', 'seo', 'Default meta description', 'Aim for 150–160 characters.', 'textarea', '[]', null, null, true, 3),
('seo.og_image', '"/brand/range-poster-dark.jpg"', 'string', 'seo', 'Default social image', null, 'image', '[]', null, null, true, 4),
('seo.twitter_handle', '"@zionherbs"', 'string', 'seo', 'X / Twitter handle', null, 'text', '[]', null, null, true, 5),
('seo.google_verification', '""', 'string', 'seo', 'Google Search Console token', null, 'text', '[]', null, null, true, 6),
('seo.ga_measurement_id', '""', 'string', 'seo', 'Google Analytics ID', 'e.g. G-XXXXXXX', 'text', '[]', null, null, true, 7),
('seo.ai_crawlers_allowed', 'true', 'boolean', 'seo', 'Allow AI crawlers',
 'Lets GPTBot, ClaudeBot, PerplexityBot and friends read the site, so it can be cited in AI answers.',
 'toggle', '[]', null, null, false, 8),
('seo.llms_txt_enabled', 'true', 'boolean', 'seo', 'Publish /llms.txt',
 'A plain-text brand and product summary written for language models.', 'toggle', '[]', null, null, false, 9),
('seo.geo_regions', '["Tamil Nadu","Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","India"]',
 'json', 'seo', 'Priority regions',
 'Places the content and local schema should target.', 'json', '[]', null, null, true, 10)

on conflict (key) do nothing;

-- =====================================================================
-- THEME -- the shipped preset. Admin can clone and edit this.
-- =====================================================================
insert into theme_presets (name, slug, description, is_active, is_system, tokens)
values (
 'Lacquer & Gold', 'lacquer-gold',
 'The house style: brewed-black ground, foil gold, and one saturated botanical colour at a time.',
 true, true,
 '{
   "color": {
     "ink":        "#14100C",
     "ink-raised": "#1E1811",
     "ink-line":   "#2E2619",
     "gold":       "#C8A44D",
     "gold-lit":   "#EBD08A",
     "parchment":  "#F4EDE0",
     "muted":      "#A2957F",
     "success":    "#5C8A4A",
     "danger":     "#B4472F"
   },
   "font": {
     "display": "Marcellus",
     "body":    "Jost",
     "script":  "Italianno"
   },
   "scale": {
     "radius":    "2px",
     "radius-lg": "4px",
     "maxWidth":  "1240px",
     "density":   "comfortable"
   },
   "motion": { "enabled": true, "intensity": "subtle" }
 }'::jsonb
) on conflict (slug) do nothing;

-- =====================================================================
-- CATEGORIES
-- =====================================================================
insert into categories (name, slug, description, sort_order) values
 ('Single-origin infusions', 'single-origin',
  'One botanical, nothing else. Six of them.', 1),
 ('Gift sets', 'gift-sets',
  'Curated boxes for gifting and for trying the range.', 2)
on conflict (slug) do nothing;

-- =====================================================================
-- LOCATION (GEO / LocalBusiness schema)
-- =====================================================================
insert into locations (name, kind, city, state, country, phone, whatsapp, email,
                       service_areas, is_primary, opening_hours)
select 
 'ZION Herbs', 'hq', 'Chennai', 'Tamil Nadu', 'India',
 '+91 63840 13131', '916384013131', 'hello@zionherbs.in',
 '["Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","Erode","Tirunelveli","All India"]'::jsonb,
 true,
 '[{"day":"Monday","opens":"09:00","closes":"18:00"},
   {"day":"Tuesday","opens":"09:00","closes":"18:00"},
   {"day":"Wednesday","opens":"09:00","closes":"18:00"},
   {"day":"Thursday","opens":"09:00","closes":"18:00"},
   {"day":"Friday","opens":"09:00","closes":"18:00"},
   {"day":"Saturday","opens":"10:00","closes":"16:00"}]'::jsonb
where not exists (select 1 from locations where name = 'ZION Herbs' and city = 'Chennai');

-- =====================================================================
-- NAVIGATION
-- =====================================================================
insert into nav_items (menu, label, href, sort_order)
select * from (values
 ('header','Shop','/shop',1),
 ('header','The six','/the-six',2),
 ('header','Our roots','/our-roots',3),
 ('header','Brewing','/brewing',4),
 ('header','Refer & earn','/refer',5),
 ('footer_shop','All teas','/shop',1),
 ('footer_shop','Gift sets','/shop?category=gift-sets',2),
 ('footer_shop','Discovery box','/product/the-six-discovery-box',3),
 ('footer_learn','Brewing guide','/brewing',1),
 ('footer_learn','Herb library','/the-six',2),
 ('footer_learn','Questions','/faq',3),
 ('footer_company','Our roots','/our-roots',1),
 ('footer_company','Contact','/contact',2),
 ('footer_company','Refer a friend','/refer',3),
 ('legal','Shipping','/p/shipping-policy',1),
 ('legal','Returns','/p/returns-policy',2),
 ('legal','Privacy','/p/privacy-policy',3),
 ('legal','Terms','/p/terms',4)
) as v(menu, label, href, sort_order)
where not exists (
  select 1 from nav_items n where n.menu = v.menu and n.href = v.href and n.label = v.label
);
