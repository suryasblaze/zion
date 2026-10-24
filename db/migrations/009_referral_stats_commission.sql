-- =====================================================================
-- 009  Count commission in a referrer's earnings.
--
-- referral_stats summed referrals.referrer_points_awarded, which is the
-- one-off bonus and nothing else. With commission paid per order, a
-- referrer's own page would have shown them a figure that stopped
-- growing while their balance kept rising -- the most quietly
-- infuriating kind of wrong number, because it looks like being
-- underpaid.
--
-- Reported as two figures rather than one total. "Where did this come
-- from" is the first question anyone asks about a balance, and a single
-- number cannot answer it.
-- =====================================================================

-- Dropped rather than replaced: "create or replace" cannot reorder or
-- rename a view's columns, and this adds two in the middle. Safe in the
-- same transaction -- nothing can observe the gap.
drop view if exists referral_stats;

create view referral_stats as
select
  u.id                                            as referrer_id,
  u.full_name,
  u.email,
  u.referral_code,
  u.wallet_balance,

  (select count(*) from referral_clicks c
    where c.code = u.referral_code)               as clicks,

  count(r.id)                                     as signups,
  count(r.id) filter (
    where r.status = any (array['qualified', 'rewarded'])
  )                                               as conversions,

  -- The joining bonus, paid once per referee.
  coalesce(sum(r.referrer_points_awarded), 0)::bigint   as bonus_points,

  -- Commission, paid on every order a referee places. Read straight
  -- from order_rewards rather than through the join above, which would
  -- multiply it by the number of referrals.
  coalesce((
    select sum(orw.points)
      from order_rewards orw
     where orw.user_id = u.id
       and orw.kind = 'commission'
       and orw.reversed_at is null
  ), 0)::bigint                                   as commission_points,

  -- Kept under the old name so nothing reading it breaks, but it now
  -- means everything earned from referring, which is what the label on
  -- the page always claimed.
  (
    coalesce(sum(r.referrer_points_awarded), 0)
    + coalesce((
        select sum(orw.points)
          from order_rewards orw
         where orw.user_id = u.id
           and orw.kind = 'commission'
           and orw.reversed_at is null
      ), 0)
  )::bigint                                       as points_earned,

  case
    when (select count(*) from referral_clicks c where c.code = u.referral_code) > 0
    then round(100.0 * count(r.id)::numeric
         / (select count(*) from referral_clicks c where c.code = u.referral_code)::numeric, 2)
    else 0::numeric
  end                                             as signup_rate_pct

from users u
left join referrals r on r.referrer_id = u.id
group by u.id;
