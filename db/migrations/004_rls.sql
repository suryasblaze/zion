-- =====================================================================
-- ZION Herbs -- 004_rls.sql
--
-- The Flask API is the only thing that talks to this database, and it
-- connects with the service role key, which bypasses RLS. So RLS here is
-- not the authorisation model -- it is the seatbelt for the day someone
-- pastes the anon key into a browser, or wires up supabase-js directly.
--
-- Posture: deny everything to anon and authenticated. Grant public read
-- only on rows that are already public on the website anyway.
-- =====================================================================

-- Supabase ships the `anon` and `authenticated` roles. A plain Postgres
-- (a local test database, a self-hosted instance) does not, so create them
-- if they are absent. Harmless on Supabase, where the branch is skipped.
do $do$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end
$do$;

do $do$
declare t text;
begin
  foreach t in array array[
    'users','user_addresses','categories','products','product_variants',
    'product_images','reviews','carts','cart_items','coupons','orders',
    'order_items','order_events','admin_settings','referral_clicks',
    'referrals','wallet_transactions','theme_presets','page_sections',
    'nav_items','pages','faqs','locations','testimonials','media_assets',
    'contact_messages','newsletter_subscribers','audit_log','redirects'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------
-- Public read: catalogue and marketing content only. No prices are
-- secret, but nothing here exposes a person, an order, or a balance.
-- ---------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_variants','product_images',
    'theme_presets','page_sections','nav_items','pages','faqs',
    'locations','testimonials'
  ]
  loop
    execute format('drop policy if exists %I on %I', 'public_read_' || t, t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      'public_read_' || t, t);
  end loop;
end
$do$;

-- Reviews: only approved ones are public.
drop policy if exists public_read_reviews on reviews;
create policy public_read_reviews on reviews
  for select to anon, authenticated using (is_approved);

-- Settings: only the ones explicitly marked public (theme, contact,
-- shipping thresholds). Referral economics and keys stay server-side.
drop policy if exists public_read_settings on admin_settings;
create policy public_read_settings on admin_settings
  for select to anon, authenticated using (is_public);

-- Everything else -- users, orders, wallet_transactions, referrals,
-- audit_log -- has RLS on with no policy at all, which means: no rows,
-- to anyone, through the anon or authenticated roles. Only the service
-- role (the Flask API) can see them.
