-- =====================================================================
-- ZION Herbs -- 006_event_signups.sql
--
-- Event sampling. Someone opens a link at a stall, gives a name, a phone
-- number and the flavour they want to try, and walks away with a claim
-- code. Staff look the code up and hand over the sample.
--
-- The claim code exists because the alternative is staff trusting a
-- screenshot. A short, unique, human-readable code can be checked in the
-- admin panel in a couple of seconds, and can only be redeemed once.
-- =====================================================================

create table if not exists event_signups (
  id            uuid primary key default gen_random_uuid(),

  -- Which event this belongs to. One shop may run several, and the
  -- per-phone limit below has to be scoped to a single event rather than
  -- barring someone from every future one.
  event_slug    text not null default 'default',
  event_name    text,

  full_name     text not null,
  phone         text not null,
  email         citext,

  -- The product is snapshotted alongside its id: if a product is renamed
  -- or removed later, the record of what was promised must survive.
  product_id    uuid references products(id) on delete set null,
  product_name  text not null,
  product_slug  text,

  claim_code    text not null unique,
  status        text not null default 'pending'
                  check (status in ('pending','claimed','cancelled','expired')),
  claimed_at    timestamptz,
  claimed_by    uuid references users(id) on delete set null,

  note          text,
  source        text default 'link',     -- link | qr | whatsapp | instagram
  ip_hash       text,                    -- sha256(ip + pepper); never the address
  user_agent    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One free sample per phone, per event. A constraint rather than a
  -- check in the application, because the application is not the only
  -- thing that can insert, and a stall queue is exactly where someone
  -- will submit the form three times.
  constraint one_sample_per_phone unique (event_slug, phone)
);

create index if not exists idx_event_signups_event
  on event_signups(event_slug, created_at desc);
create index if not exists idx_event_signups_status
  on event_signups(status);
create index if not exists idx_event_signups_code
  on event_signups(claim_code);
create index if not exists idx_event_signups_product
  on event_signups(product_id);
create index if not exists idx_event_signups_phone
  on event_signups(phone);

drop trigger if exists trg_event_signups_updated on event_signups;
create trigger trg_event_signups_updated before update on event_signups
  for each row execute function set_updated_at();

-- RLS, matching the posture of every other table: the Flask API holds the
-- service key and bypasses it; nothing else gets to read sign-ups, which
-- carry names and phone numbers.
alter table event_signups enable row level security;
alter table event_signups force row level security;

-- Per-flavour tally for the admin screen. The whole point of the exercise
-- is finding out which tea people reach for.
create or replace view event_signup_tally as
select
  s.event_slug,
  coalesce(p.name, s.product_name)              as product_name,
  p.slug                                        as product_slug,
  p.accent_color,
  count(*)                                      as signups,
  count(*) filter (where s.status = 'claimed')  as claimed
from event_signups s
left join products p on p.id = s.product_id
group by s.event_slug, coalesce(p.name, s.product_name), p.slug, p.accent_color;
