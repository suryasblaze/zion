-- =====================================================================
-- ZION Herbs -- seed_auth.sql
-- Who may create an account. Re-runnable.
-- =====================================================================

insert into admin_settings
  (key, value, value_type, group_key, label, description, ui_control, options, min_value, max_value, is_public, sort_order)
values
('auth.public_signup', 'false', 'boolean', 'store',
 'Let visitors create their own account',
 'Off: accounts are made by you under Customers, and the sign-in page offers no way to register. On: anyone can sign up. Note the referral programme only gains new people through signup, so a referral link has nobody to convert while this is off.',
 'toggle', '[]', null, null, true, 15)
on conflict (key) do nothing;
