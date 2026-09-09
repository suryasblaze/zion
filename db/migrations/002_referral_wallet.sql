-- =====================================================================
-- ZION Herbs -- 002_referral_wallet.sql
-- Referral attribution, wallet ledger, admin-controlled settings.
--
-- Design rules enforced here rather than in application code, because the
-- application is not the only thing that can touch these rows:
--   1. A referee can be referred exactly once, ever      -> unique(referee_id)
--   2. Nobody can refer themselves                       -> check + trigger
--   3. A reward is paid at most once per referral        -> unique idempotency_key
--   4. A wallet balance can never go negative            -> check + locked update
--   5. The ledger is the truth; users.wallet_balance is a cache kept in
--      step inside the same transaction, under a row lock.
-- =====================================================================

-- =====================================================================
-- ADMIN SETTINGS  (every tunable number in the referral programme)
-- =====================================================================
create table if not exists admin_settings (
  key          text primary key,
  value        jsonb not null,
  value_type   text not null default 'string'
                 check (value_type in ('string','number','integer','boolean','json','color','richtext','image','select')),
  group_key    text not null default 'general',
  label        text not null,
  description  text,
  ui_control   text not null default 'text'
                 check (ui_control in ('text','textarea','number','toggle','select','color','image','json','slider','richtext')),
  options      jsonb not null default '[]'::jsonb,   -- for select controls
  min_value    numeric,
  max_value    numeric,
  is_public    boolean not null default false,       -- exposed to the storefront?
  sort_order   integer not null default 0,
  updated_by   uuid references users(id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index if not exists idx_settings_group  on admin_settings(group_key, sort_order);
create index if not exists idx_settings_public on admin_settings(is_public) where is_public;

drop trigger if exists trg_settings_updated on admin_settings;
create trigger trg_settings_updated before update on admin_settings
  for each row execute function set_updated_at();

-- =====================================================================
-- REFERRAL CLICKS  (link analytics: every visit through a referral link)
-- =====================================================================
create table if not exists referral_clicks (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  referrer_id      uuid references users(id) on delete cascade,
  visitor_token    text,                -- anonymous cookie id, links click -> signup
  ip_hash          text,                -- sha256(ip + pepper). Never store raw IPs.
  user_agent       text,
  landing_path     text,
  referer_url      text,
  utm              jsonb not null default '{}'::jsonb,
  converted_user_id uuid references users(id) on delete set null,
  converted_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_clicks_code    on referral_clicks(code, created_at desc);
create index if not exists idx_clicks_ref     on referral_clicks(referrer_id, created_at desc);
create index if not exists idx_clicks_visitor on referral_clicks(visitor_token);
create index if not exists idx_clicks_conv    on referral_clicks(converted_user_id);

-- =====================================================================
-- REFERRALS  (one row per referred person, for their whole lifetime)
-- =====================================================================
create table if not exists referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references users(id) on delete cascade,

  -- One referral per referee, enforced by the database. This single
  -- constraint is what stops a replayed signup or a double-submitted form
  -- from creating a second reward path for the same person.
  referee_id   uuid not null unique references users(id) on delete cascade,

  code         text not null,
  click_id     uuid references referral_clicks(id) on delete set null,

  status       text not null default 'pending'
                 check (status in ('pending','qualified','rewarded','rejected','reversed')),

  -- Config snapshots. Taken when the referral is created so that changing
  -- the admin settings tomorrow cannot retroactively alter what someone
  -- was promised today.
  referee_discount_type    text not null default 'percent'
                             check (referee_discount_type in ('percent','fixed')),
  referee_discount_value   numeric(10,2) not null default 0,
  referrer_points_config   integer not null default 0,
  referee_points_config    integer not null default 0,

  -- Actuals, written when the qualifying order is paid.
  qualifying_order_id      uuid references orders(id) on delete set null,
  referee_discount_applied numeric(10,2) not null default 0,
  referrer_points_awarded  integer not null default 0,
  referee_points_awarded   integer not null default 0,

  fraud_flags   jsonb not null default '[]'::jsonb,
  rejected_reason text,

  created_at   timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at  timestamptz,
  updated_at   timestamptz not null default now(),

  -- Rule 2, at the storage layer.
  constraint no_self_referral check (referrer_id <> referee_id)
);
create index if not exists idx_referrals_referrer on referrals(referrer_id, created_at desc);
create index if not exists idx_referrals_status   on referrals(status);
create index if not exists idx_referrals_code     on referrals(code);
create index if not exists idx_referrals_order    on referrals(qualifying_order_id);

drop trigger if exists trg_referrals_updated on referrals;
create trigger trg_referrals_updated before update on referrals
  for each row execute function set_updated_at();

-- =====================================================================
-- WALLET LEDGER  (append-only; the source of truth for every point)
-- =====================================================================
create table if not exists wallet_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,

  type           text not null check (type in (
                   'referral_reward',   -- referrer earned points
                   'welcome_bonus',     -- referee joined via a link
                   'signup_bonus',
                   'redeem',            -- spent at checkout (negative)
                   'redeem_refund',     -- order cancelled, points returned
                   'reversal',          -- reward clawed back on refund (negative)
                   'admin_credit',
                   'admin_debit',
                   'review_reward',
                   'promo')),

  points         integer not null,          -- signed: + earns, - spends
  balance_after  integer not null check (balance_after >= 0),
  money_value    numeric(10,2) not null default 0,  -- rupee value at the time

  reference_type text,                      -- 'referral' | 'order' | 'manual'
  reference_id   uuid,

  -- Rule 3. Any operation that must happen at most once names itself here,
  -- e.g. 'referral_reward:<referral_id>'. A retry, a duplicate webhook, or
  -- two workers racing all collide on this unique index instead of paying
  -- the reward twice.
  idempotency_key text unique,

  note           text,
  created_by     uuid references users(id) on delete set null,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_wallet_user on wallet_transactions(user_id, created_at desc);
create index if not exists idx_wallet_type on wallet_transactions(type);
create index if not exists idx_wallet_ref  on wallet_transactions(reference_type, reference_id);

-- =====================================================================
-- wallet_move() -- the ONLY sanctioned way to change a balance.
--
-- Takes a row lock on the user, appends to the ledger, and moves the
-- cached balance in one atomic step. Two concurrent calls for the same
-- user serialise on the lock, so balance_after is always correct; a
-- repeated idempotency_key is a no-op that returns the original row.
-- =====================================================================
create or replace function wallet_move(
  p_user_id         uuid,
  p_points          integer,
  p_type            text,
  p_reference_type  text default null,
  p_reference_id    uuid default null,
  p_idempotency_key text default null,
  p_money_value     numeric default 0,
  p_note            text default null,
  p_created_by      uuid default null
) returns wallet_transactions
language plpgsql as $fn$
declare
  v_existing wallet_transactions;
  v_balance  integer;
  v_row      wallet_transactions;
begin
  -- Idempotent replay: hand back what we did the first time.
  if p_idempotency_key is not null then
    select * into v_existing from wallet_transactions
      where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  -- Serialise every concurrent mutation of this user's balance.
  select wallet_balance into v_balance
    from users where id = p_user_id for update;

  if not found then
    raise exception 'wallet_move: user % not found', p_user_id
      using errcode = 'no_data_found';
  end if;

  v_balance := v_balance + p_points;

  if v_balance < 0 then
    raise exception 'wallet_move: insufficient balance (have %, need %)',
      v_balance - p_points, abs(p_points)
      using errcode = 'check_violation';
  end if;

  insert into wallet_transactions (
    user_id, type, points, balance_after, money_value,
    reference_type, reference_id, idempotency_key, note, created_by
  ) values (
    p_user_id, p_type, p_points, v_balance, coalesce(p_money_value, 0),
    p_reference_type, p_reference_id, p_idempotency_key, p_note, p_created_by
  )
  returning * into v_row;

  update users set wallet_balance = v_balance where id = p_user_id;

  return v_row;
exception
  -- Lost the race on the unique index: the other writer already paid it.
  when unique_violation then
    select * into v_existing from wallet_transactions
      where idempotency_key = p_idempotency_key;
    return v_existing;
end;
$fn$;

-- =====================================================================
-- Self-referral guard that also catches the indirect cases the simple
-- id-inequality check cannot see (shared email root, shared phone).
-- =====================================================================
create or replace function guard_self_referral() returns trigger
language plpgsql as $fn$
declare
  v_ref_email   citext;
  v_ref_phone   text;
  v_tee_email   citext;
  v_tee_phone   text;
begin
  select email, phone into v_ref_email, v_ref_phone
    from users where id = new.referrer_id;
  select email, phone into v_tee_email, v_tee_phone
    from users where id = new.referee_id;

  if v_ref_email = v_tee_email then
    raise exception 'self-referral: identical email' using errcode = 'check_violation';
  end if;

  if v_ref_phone is not null and v_ref_phone <> ''
     and v_ref_phone = v_tee_phone then
    raise exception 'self-referral: identical phone' using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_guard_self_referral on referrals;
create trigger trg_guard_self_referral before insert on referrals
  for each row execute function guard_self_referral();

-- =====================================================================
-- Reporting view: referral performance per referrer.
-- =====================================================================
create or replace view referral_stats as
select
  u.id                                            as referrer_id,
  u.full_name,
  u.email,
  u.referral_code,
  u.wallet_balance,
  (select count(*) from referral_clicks c
     where c.code = u.referral_code)              as clicks,
  count(r.id)                                     as signups,
  count(r.id) filter (where r.status in ('qualified','rewarded')) as conversions,
  coalesce(sum(r.referrer_points_awarded), 0)     as points_earned,
  case when (select count(*) from referral_clicks c where c.code = u.referral_code) > 0
       then round(100.0 * count(r.id)
            / (select count(*) from referral_clicks c where c.code = u.referral_code), 2)
       else 0 end                                 as signup_rate_pct
from users u
left join referrals r on r.referrer_id = u.id
group by u.id;
