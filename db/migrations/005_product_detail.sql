-- =====================================================================
-- ZION Herbs -- 005_product_detail.sql
--
-- The home page now opens a full detail panel per product without
-- navigating away. Three of the things it shows had nowhere to live:
-- what it tastes like, where it comes from, and why someone should want
-- it. `nutrition` already existed on products but was never populated.
--
-- Separate columns rather than more keys inside `seo` or `story`,
-- because the admin panel needs to edit each one on its own and the
-- storefront needs to show them in a fixed order.
-- =====================================================================

alter table products
  add column if not exists taste_aroma text,
  add column if not exists origin      text,
  add column if not exists why_love    jsonb not null default '[]'::jsonb;

comment on column products.taste_aroma is
  'What it tastes and smells like, in plain words. Two sentences at most.';
comment on column products.origin is
  'Where the botanical is grown or gathered, and how it is processed.';
comment on column products.why_love is
  'Short reasons to choose this one. jsonb array of strings.';
comment on column products.nutrition is
  'Per-cup facts: {"serving":"200 ml","calories":"0 kcal","caffeine":"None", "notes":[...]}';
