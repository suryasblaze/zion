-- =====================================================================
-- ZION Herbs -- 001_core.sql
-- Users, catalog, cart, orders.  Postgres 15+ / Supabase.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- utils
create or replace function set_updated_at() returns trigger
language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- =====================================================================
-- USERS
-- =====================================================================
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  phone             text,
  password_hash     text not null,
  full_name         text not null default '',
  role              text not null default 'customer'
                      check (role in ('customer','admin','staff')),

  -- referral identity (machinery lives in 002_referral_wallet.sql)
  referral_code     text not null unique,
  referred_by       uuid references users(id) on delete set null,

  -- Wallet: denormalised running total. The wallet_transactions ledger is
  -- the source of truth; this column is only ever moved inside the same
  -- transaction, under a row lock. Never write it directly.
  wallet_balance    integer not null default 0 check (wallet_balance >= 0),

  is_active         boolean not null default true,
  email_verified    boolean not null default false,
  marketing_opt_in  boolean not null default false,
  last_login_at     timestamptz,
  signup_ip_hash    text,        -- sha256(ip + pepper), fraud heuristics only
  signup_device_id  text,        -- client fingerprint, fraud heuristics only
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_users_referred_by on users(referred_by);
create index if not exists idx_users_role        on users(role);
create index if not exists idx_users_created     on users(created_at desc);
create index if not exists idx_users_signup_ip   on users(signup_ip_hash);

drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

create table if not exists user_addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  label       text not null default 'Home',
  full_name   text not null,
  phone       text not null,
  line1       text not null,
  line2       text,
  city        text not null,
  state       text not null,
  pincode     text not null,
  country     text not null default 'India',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_addresses_user on user_addresses(user_id);

drop trigger if exists trg_addresses_updated on user_addresses;
create trigger trg_addresses_updated before update on user_addresses
  for each row execute function set_updated_at();

-- =====================================================================
-- CATALOG
-- =====================================================================
create table if not exists categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  image_url    text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_categories_updated on categories;
create trigger trg_categories_updated before update on categories
  for each row execute function set_updated_at();

create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references categories(id) on delete set null,

  name             text not null,                   -- "Butterfly Pea"
  slug             text not null unique,
  script_word      text,                            -- packaging script line, e.g. "Herbal Tea"
  botanical_name   text,                            -- "Clitoria ternatea"
  tagline          text,                            -- "Nature's Blue Elixir"
  short_desc       text,
  description      text,
  story            text,                            -- long-form, feeds AEO/GEO content

  accent_color     text not null default '#C8A44D', -- drives per-product theming
  accent_soft      text,

  hero_image       text,
  gallery          jsonb not null default '[]'::jsonb,

  benefits         jsonb not null default '[]'::jsonb,  -- [{title, body, icon}]
  ingredients      jsonb not null default '[]'::jsonb,
  brewing          jsonb not null default '{}'::jsonb,  -- {temp_c, minutes, steps[]}
  badges           jsonb not null default '[]'::jsonb,
  nutrition        jsonb not null default '{}'::jsonb,

  is_caffeine_free boolean not null default true,
  is_active        boolean not null default true,
  is_featured      boolean not null default false,
  sort_order       integer not null default 0,

  rating_avg       numeric(3,2) not null default 0,
  rating_count     integer not null default 0,

  seo              jsonb not null default '{}'::jsonb, -- {title, description, keywords[], og_image, faq[]}

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_products_active on products(is_active, sort_order);
create index if not exists idx_products_cat    on products(category_id);
create index if not exists idx_products_feat   on products(is_featured) where is_featured;

drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();

-- Pack sizes / SKUs. Price lives here, never on the product row.
create table if not exists product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id) on delete cascade,
  sku              text not null unique,
  label            text not null,                    -- "100 g"
  weight_grams     integer,
  price            numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price >= 0),
  stock            integer not null default 0 check (stock >= 0),
  low_stock_at     integer not null default 5,
  is_default       boolean not null default false,
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_variants_product on product_variants(product_id);
create unique index if not exists idx_variants_one_default
  on product_variants(product_id) where is_default;

drop trigger if exists trg_variants_updated on product_variants;
create trigger trg_variants_updated before update on product_variants
  for each row execute function set_updated_at();

create table if not exists product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_prodimg_product on product_images(product_id, sort_order);

create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  author_name text not null default 'Verified buyer',
  rating      integer not null check (rating between 1 and 5),
  title       text,
  body        text,
  is_approved boolean not null default false,
  is_verified boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_reviews_product on reviews(product_id, is_approved);

-- =====================================================================
-- CART
-- =====================================================================
create table if not exists carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references users(id) on delete cascade,
  session_key text unique,                       -- guest carts
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cart_owner check (user_id is not null or session_key is not null)
);
drop trigger if exists trg_carts_updated on carts;
create trigger trg_carts_updated before update on carts
  for each row execute function set_updated_at();

create table if not exists cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index if not exists idx_cartitems_cart on cart_items(cart_id);

-- =====================================================================
-- COUPONS
-- =====================================================================
create table if not exists coupons (
  id             uuid primary key default gen_random_uuid(),
  code           citext not null unique,
  description    text,
  discount_type  text not null check (discount_type in ('percent','fixed')),
  value          numeric(10,2) not null check (value >= 0),
  min_order      numeric(10,2) not null default 0,
  max_discount   numeric(10,2),
  usage_limit    integer,
  per_user_limit integer not null default 1,
  used_count     integer not null default 0,
  starts_at      timestamptz,
  ends_at        timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists trg_coupons_updated on coupons;
create trigger trg_coupons_updated before update on coupons
  for each row execute function set_updated_at();

-- =====================================================================
-- ORDERS
-- =====================================================================
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null unique,            -- ZION-2609-0001
  user_id        uuid references users(id) on delete set null,
  email          citext not null,
  phone          text,

  status         text not null default 'pending'
                   check (status in ('pending','confirmed','packed','shipped','delivered','cancelled','refunded')),
  payment_status text not null default 'unpaid'
                   check (payment_status in ('unpaid','paid','failed','refunded','partially_refunded')),
  payment_method text not null default 'cod'
                   check (payment_method in ('cod','razorpay','upi','whatsapp')),
  payment_ref    text,

  subtotal          numeric(10,2) not null default 0,
  coupon_code       citext,
  coupon_discount   numeric(10,2) not null default 0,
  referral_discount numeric(10,2) not null default 0,  -- referee first-order discount
  coins_redeemed    integer       not null default 0,  -- wallet points spent
  coins_value       numeric(10,2) not null default 0,  -- rupee value of those points
  shipping_fee      numeric(10,2) not null default 0,
  tax               numeric(10,2) not null default 0,
  total             numeric(10,2) not null default 0,
  currency          text not null default 'INR',

  shipping_address jsonb not null default '{}'::jsonb,
  billing_address  jsonb not null default '{}'::jsonb,
  customer_note    text,
  admin_note       text,
  tracking_number  text,
  tracking_url     text,

  referral_code_used text,   -- denormalised attribution snapshot for reporting

  placed_at    timestamptz not null default now(),
  paid_at      timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_orders_user    on orders(user_id, placed_at desc);
create index if not exists idx_orders_status  on orders(status);
create index if not exists idx_orders_pay     on orders(payment_status);
create index if not exists idx_orders_placed  on orders(placed_at desc);
create index if not exists idx_orders_refcode on orders(referral_code_used);

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  variant_id    uuid references product_variants(id) on delete set null,
  product_name  text not null,   -- snapshots: history must survive catalog edits
  variant_label text not null,
  sku           text,
  image_url     text,
  unit_price    numeric(10,2) not null,
  quantity      integer not null check (quantity > 0),
  line_total    numeric(10,2) not null
);
create index if not exists idx_orderitems_order on order_items(order_id);

create table if not exists order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  status     text not null,
  note       text,
  actor_id   uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_orderevents_order on order_events(order_id, created_at);
