-- =====================================================================
-- 010  Reviews that mean something.
--
-- The table and a POST endpoint existed; neither was finished. The
-- endpoint imported optional_auth and never applied it, so user_id was
-- always null, is_verified was always false, and anyone on the internet
-- could post any number of reviews for any product without an account.
-- Nothing displayed them either, which is the only reason it was not
-- already a problem.
--
-- This adds what makes a review trustworthy: one per person per
-- product, tied to an account, and a rating on the product that is
-- derived rather than stored by hand.
-- =====================================================================

-- One review per person per product.
--
-- Enforced here rather than in the application because the check and
-- the insert are two statements, and a double-tapped submit button runs
-- them twice concurrently. Partial, so the old rows with no user_id --
-- there are none, but the column is nullable -- do not collide.
create unique index if not exists reviews_one_per_user_product
  on reviews (product_id, user_id)
  where user_id is not null;

-- The product page reads approved reviews, newest first.
create index if not exists reviews_approved_idx
  on reviews (product_id, created_at desc)
  where is_approved;

-- The account page asks "what have I already reviewed".
create index if not exists reviews_user_idx
  on reviews (user_id, created_at desc);

-- Which order the review came from. Used to show "bought in March" and
-- to prove the purchase was real if a review is ever disputed.
alter table reviews add column if not exists order_id uuid references orders(id) on delete set null;

-- Admin's reason for rejecting, so a decision can be explained later.
alter table reviews add column if not exists admin_note text;

alter table reviews add column if not exists updated_at timestamptz not null default now();


-- ------------------------------------------------- derived rating
--
-- products.rating_avg and rating_count existed and nothing ever wrote
-- to them. A number that has to be updated by hand eventually disagrees
-- with the rows it summarises -- usually after a review is deleted,
-- which is the moment anyone looks closely.
--
-- A trigger cannot drift: approve, edit, reject or delete a review and
-- the product's figures follow in the same transaction.
create or replace function recalc_product_rating()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update products p
     set rating_avg = coalesce((
           select round(avg(r.rating)::numeric, 2)
             from reviews r
            where r.product_id = target and r.is_approved
         ), 0),
         rating_count = (
           select count(*)
             from reviews r
            where r.product_id = target and r.is_approved
         )
   where p.id = target;
  return null;
end;
$$;

drop trigger if exists reviews_recalc_rating on reviews;

create trigger reviews_recalc_rating
after insert or update or delete on reviews
for each row execute function recalc_product_rating();


-- Bring the existing products in line with whatever is in the table
-- today, so the two agree from this point on.
update products p
   set rating_avg = coalesce((
         select round(avg(r.rating)::numeric, 2)
           from reviews r where r.product_id = p.id and r.is_approved
       ), 0),
       rating_count = (
         select count(*) from reviews r
          where r.product_id = p.id and r.is_approved
       );


-- ------------------------------------------------------- settings
insert into admin_settings
  (key, value, value_type, group_key, label, description,
   ui_control, options, min_value, max_value, is_public, sort_order)
select * from (values
  ('reviews.require_purchase',
   'true'::jsonb, 'boolean', 'store',
   'Only buyers can review',
   'A review may only be written by someone whose order containing that '
   || 'tea has been delivered. Turning this off lets any signed-in '
   || 'customer review anything, which is how review sections stop being '
   || 'worth reading.',
   'toggle', '[]'::jsonb, null::numeric, null::numeric, true, 40),

  ('reviews.auto_approve',
   'false'::jsonb, 'boolean', 'store',
   'Publish reviews without reading them',
   'Off means every review waits for you under Content > Reviews. On '
   || 'means they appear immediately, including the angry one written at '
   || 'two in the morning.',
   'toggle', '[]'::jsonb, null::numeric, null::numeric, false, 41)
) as t(key, value, value_type, group_key, label, description,
       ui_control, options, min_value, max_value, is_public, sort_order)
where not exists (select 1 from admin_settings s where s.key = t.key);
