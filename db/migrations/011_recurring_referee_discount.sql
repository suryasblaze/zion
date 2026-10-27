-- =====================================================================
-- 011  Let the referee's discount apply to every order.
--
-- It was a one-time welcome: 20% off the first order and nothing after.
-- That is the usual shape of these programmes, and it is not the one
-- this shop wants -- the referrer earns on every order their referee
-- places, and the referee should save on every order too.
--
-- Off by default. On, it is the most expensive setting in the panel:
-- combined with cashback and commission at 10% each, a referred
-- customer's every order gives back the discount plus a fifth of the
-- subtotal in coins, for as long as they keep buying.
-- =====================================================================

insert into admin_settings
  (key, value, value_type, group_key, label, description,
   ui_control, options, min_value, max_value, is_public, sort_order)
select * from (values
  ('referral.referee_discount_every_order',
   'false'::jsonb, 'boolean', 'referral',
   'Discount applies to every order',
   'Off: the referred customer saves on their first order only. On: they '
   || 'save on every order, for as long as the account exists. Check this '
   || 'against the commission and cashback percentages before turning it '
   || 'on -- all three come out of the same order.',
   'toggle', '[]'::jsonb, null::numeric, null::numeric, true, 6)
) as t(key, value, value_type, group_key, label, description,
       ui_control, options, min_value, max_value, is_public, sort_order)
where not exists (select 1 from admin_settings s where s.key = t.key);
