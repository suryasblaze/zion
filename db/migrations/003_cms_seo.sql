-- =====================================================================
-- ZION Herbs -- 003_cms_seo.sql
-- Everything the admin can restyle, rewrite, reorder or republish
-- without a developer: theme tokens, page sections, navigation,
-- long-form content, FAQs (AEO), locations (GEO), media, inbox.
-- =====================================================================

-- =====================================================================
-- THEME PRESETS -- the "change the design" surface.
-- A preset is a complete token set. Exactly one is live at a time;
-- the admin can clone, edit and preview before publishing.
-- =====================================================================
create table if not exists theme_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  is_active   boolean not null default false,
  is_system   boolean not null default false,   -- shipped presets cannot be deleted

  -- CSS custom properties, sprayed onto :root by the storefront
  tokens      jsonb not null default '{}'::jsonb,
  -- {
  --   "color": { "ink":"#14100C", "gold":"#C8A44D", ... },
  --   "font":  { "display":"Marcellus", "body":"Jost", "script":"Italianno" },
  --   "scale": { "radius":"2px", "maxWidth":"1240px", "density":"comfortable" },
  --   "motion":{ "enabled":true, "intensity":"subtle" }
  -- }

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists idx_theme_one_active
  on theme_presets(is_active) where is_active;

drop trigger if exists trg_theme_updated on theme_presets;
create trigger trg_theme_updated before update on theme_presets
  for each row execute function set_updated_at();

-- =====================================================================
-- PAGE SECTIONS -- ordered, toggleable blocks that compose each page.
-- The storefront renders whatever this table says, in this order.
-- =====================================================================
create table if not exists page_sections (
  id          uuid primary key default gen_random_uuid(),
  page        text not null default 'home',      -- home | about | shop | ...
  section_key text not null,                     -- hero | spectrum | ritual | referral ...
  component   text not null,                     -- React component name to mount
  eyebrow     text,
  title       text,
  subtitle    text,
  body        text,
  media       jsonb not null default '{}'::jsonb,
  items       jsonb not null default '[]'::jsonb,  -- repeatable children
  cta         jsonb not null default '{}'::jsonb,  -- {label, href, style}
  settings    jsonb not null default '{}'::jsonb,  -- per-section knobs
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (page, section_key)
);
create index if not exists idx_sections_page on page_sections(page, sort_order);

drop trigger if exists trg_sections_updated on page_sections;
create trigger trg_sections_updated before update on page_sections
  for each row execute function set_updated_at();

-- =====================================================================
-- NAVIGATION
-- =====================================================================
create table if not exists nav_items (
  id         uuid primary key default gen_random_uuid(),
  menu       text not null default 'header'      -- header | footer_shop | footer_learn | legal
               check (menu in ('header','footer_shop','footer_learn','footer_company','legal','mobile')),
  label      text not null,
  href       text not null,
  parent_id  uuid references nav_items(id) on delete cascade,
  badge      text,
  is_external boolean not null default false,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_nav_menu on nav_items(menu, sort_order);

-- =====================================================================
-- STANDALONE PAGES  (about, policies, long-form guides)
-- =====================================================================
create table if not exists pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  excerpt      text,
  body         text,                              -- markdown
  hero_image   text,
  page_type    text not null default 'page'
                 check (page_type in ('page','legal','guide','journal')),
  seo          jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  published_at timestamptz default now(),
  author       text,
  read_minutes integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_pages_type on pages(page_type, is_published);

drop trigger if exists trg_pages_updated on pages;
create trigger trg_pages_updated before update on pages
  for each row execute function set_updated_at();

-- =====================================================================
-- FAQ  -- the Answer-Engine surface.
-- Rendered visibly AND emitted as schema.org FAQPage JSON-LD, which is
-- what assistants and AI search actually parse.
-- =====================================================================
create table if not exists faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  category   text not null default 'general',
  scope      text not null default 'global',   -- 'global' | 'product:<slug>' | 'page:<slug>'
  product_id uuid references products(id) on delete cascade,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_faqs_scope on faqs(scope, sort_order);
create index if not exists idx_faqs_prod  on faqs(product_id);

drop trigger if exists trg_faqs_updated on faqs;
create trigger trg_faqs_updated before update on faqs
  for each row execute function set_updated_at();

-- =====================================================================
-- LOCATIONS -- the Generative/Local surface (schema.org LocalBusiness).
-- =====================================================================
create table if not exists locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null default 'hq'
                  check (kind in ('hq','store','pickup','service_area')),
  line1         text,
  line2         text,
  city          text not null,
  state         text not null,
  pincode       text,
  country       text not null default 'India',
  latitude      numeric(10,7),
  longitude     numeric(10,7),
  phone         text,
  email         text,
  whatsapp      text,
  opening_hours jsonb not null default '[]'::jsonb,  -- [{day, opens, closes}]
  map_url       text,
  service_areas jsonb not null default '[]'::jsonb,  -- ["Chennai","Coimbatore",...]
  is_primary    boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_locations_updated on locations;
create trigger trg_locations_updated before update on locations
  for each row execute function set_updated_at();

-- =====================================================================
-- TESTIMONIALS
-- =====================================================================
create table if not exists testimonials (
  id         uuid primary key default gen_random_uuid(),
  author     text not null,
  role       text,
  city       text,
  quote      text not null,
  rating     integer check (rating between 1 and 5),
  avatar_url text,
  product_id uuid references products(id) on delete set null,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- MEDIA LIBRARY (Supabase Storage mirror)
-- =====================================================================
create table if not exists media_assets (
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null default 'zion-media',
  path         text not null,
  url          text not null,
  filename     text not null,
  mime_type    text,
  size_bytes   bigint,
  width        integer,
  height       integer,
  alt          text default '',
  folder       text not null default 'uploads',
  uploaded_by  uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (bucket, path)
);
create index if not exists idx_media_folder on media_assets(folder, created_at desc);

-- =====================================================================
-- INBOX + LIST
-- =====================================================================
create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      citext not null,
  phone      text,
  subject    text,
  message    text not null,
  status     text not null default 'new' check (status in ('new','read','replied','archived')),
  source     text default 'contact_form',
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_status on contact_messages(status, created_at desc);

create table if not exists newsletter_subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  name          text,
  source        text default 'footer',
  is_subscribed boolean not null default true,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- AUDIT LOG -- who changed what in the admin panel.
-- =====================================================================
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id) on delete set null,
  actor_email text,
  action      text not null,          -- create | update | delete | login | publish
  entity      text not null,          -- products | admin_settings | orders ...
  entity_id   text,
  changes     jsonb not null default '{}'::jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_log(entity, created_at desc);
create index if not exists idx_audit_actor  on audit_log(actor_id, created_at desc);

-- =====================================================================
-- REDIRECTS (SEO hygiene when slugs change)
-- =====================================================================
create table if not exists redirects (
  id          uuid primary key default gen_random_uuid(),
  from_path   text not null unique,
  to_path     text not null,
  status_code integer not null default 301,
  hits        integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
