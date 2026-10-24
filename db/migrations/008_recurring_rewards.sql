-- =====================================================================
-- 008  Rewards on every order, not just the first.
--
-- The programme paid a referrer once: a flat bonus when their referee's
-- first order qualified, and nothing afterwards. The relationship was
-- already permanent -- users.referred_by never changes once set -- so
-- the link outlived the only payment it ever produced.
--
-- This turns it into a share of every order:
--
--   self cashback   the buyer earns a percentage of their own order
--   commission      their referrer earns a percentage of it too
--
-- One level only. Commission reads users.referred_by, which holds the
-- direct referrer and nothing above it, so a grandparent earns nothing
-- by construction rather than by a rule someone has to remember.
--
-- Both default to leaving the shop as it is. Percentages that give money
-- away should be turned on deliberately, in the panel, by someone who
-- has done the arithmetic -- not switched on by a deploy.
-- =====================================================================

insert into admin_settings
  (key, value, value_type, group_key, label, description,
   ui_control, options, min_value, max_value, is_public, sort_order)
select * from (values
  ('referral.commission_percent',
   '0'::jsonb, 'number', 'referral',
   'Referrer commission (% of each order)',
   'What a referrer earns from every order their referee places, for as '
   || 'long as the account exists. 0 turns it off. This is a permanent '
   || 'share of revenue, not a one-off: at 2%, a referee spending '
   || 'Rs 1,000 a month earns their referrer Rs 240 a year.',
   'number', '[]'::jsonb, 0, 20, false, 20),

  ('referral.self_cashback_percent',
   '0'::jsonb, 'number', 'referral',
   'Buyer cashback (% of their own order)',
   'What a buyer earns back on their own order, as coins. 0 turns it '
   || 'off. Stacks with coin redemption, so check the redemption cap '
   || 'before raising it -- cashback earned on one order can come '
   || 'straight off the next.',
   'number', '[]'::jsonb, 0, 20, false, 21),

  ('referral.reward_min_order',
   '0'::jsonb, 'number', 'referral',
   'Minimum order for rewards (Rs)',
   'Orders below this earn nothing, for either party. Stops a rounding '
   || 'of coins being paid out on a trivial order.',
   'number', '[]'::jsonb, 0, 100000, false, 22)
) as t(key, value, value_type, group_key, label, description,
       ui_control, options, min_value, max_value, is_public, sort_order)
where not exists (
  select 1 from admin_settings s where s.key = t.key
);


-- Every commission and cashback payment, one row per order per kind.
--
-- The wallet ledger already records the movement; this records the
-- decision -- which order, which rate, who it was for -- so a refund can
-- reverse exactly what was paid rather than recomputing it from rates
-- that may have changed in between. The referral programme learned that
-- lesson once already, with the snapshot columns on `referrals`.
create table if not exists order_rewards (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  kind            text not null check (kind in ('self_cashback', 'commission')),
  -- The rate as it stood when this was paid. An admin changing the
  -- percentage must not rewrite what someone has already earned.
  rate_percent    numeric(6,3) not null,
  base_amount     numeric(12,2) not null,
  points          integer not null check (points >= 0),
  money_value     numeric(12,2) not null default 0,
  reversed_at     timestamptz,
  created_at      timestamptz not null default now(),

  -- One payment of each kind per order. The write races -- a webhook
  -- and an admin can both mark an order paid -- so the database
  -- decides, not the application.
  unique (order_id, kind)
);

create index if not exists order_rewards_user_idx
  on order_rewards (user_id, created_at desc);

create index if not exists order_rewards_order_idx
  on order_rewards (order_id);

alter table order_rewards enable row level security;


-- The ledger's type whitelist predates per-order rewards, so the four
-- kinds below were refused by a check constraint. Keeping the whitelist
-- rather than dropping it: it is what stops a typo inventing a new kind
-- of money, and the failure above is exactly it working.
alter table wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table wallet_transactions
  add constraint wallet_transactions_type_check check (type = any (array[
    'referral_reward', 'welcome_bonus', 'signup_bonus',
    'redeem', 'redeem_refund', 'reversal',
    'admin_credit', 'admin_debit', 'review_reward', 'promo',
    -- added by 008
    'self_cashback', 'commission',
    'self_cashback_reversal', 'commission_reversal'
  ]));
