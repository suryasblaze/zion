-- =====================================================================
-- 012  Record that a flagged referral was reviewed.
--
-- approve_flagged paid the referrer's one-off bonus and left
-- fraud_flags exactly as it found them. That was harmless when a flag
-- only gated a single payment. It is not harmless now: the recurring
-- commission and the standing discount both refuse a flagged referral,
-- so an admin could approve one and it would keep earning nothing,
-- permanently, with nothing on screen to explain why.
--
-- A timestamp rather than clearing the flags, because which flag was
-- raised is worth keeping -- "approved despite sharing an IP" is a
-- different thing to look back on than "never flagged".
-- =====================================================================

alter table referrals add column if not exists reviewed_at timestamptz;
alter table referrals add column if not exists reviewed_by uuid references users(id) on delete set null;

comment on column referrals.reviewed_at is
  'When an admin cleared the fraud flags. Null with flags present means held.';

-- Anything already marked rewarded was approved by someone at some
-- point; without this they stay blocked for every future order.
update referrals
   set reviewed_at = coalesce(rewarded_at, updated_at, created_at)
 where reviewed_at is null
   and status = 'rewarded'
   and fraud_flags <> '[]'::jsonb;
