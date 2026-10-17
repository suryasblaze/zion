-- =====================================================================
-- 007  Password resets and a record of every email sent.
--
-- Two tables, both written for the same reason: email is the one part
-- of this shop that reaches outside it, and you cannot debug what you
-- did not record.
-- =====================================================================

-- ------------------------------------------------- password_resets
--
-- The token itself is never stored. We keep sha256(token), so a dump of
-- this table hands nobody a working reset link -- the same reasoning as
-- hashing passwords, for a credential that is just as good for one use.
--
-- Rows are kept after use rather than deleted: "this link was already
-- used at 14:02" is a better answer than "this link is invalid", and it
-- is the only way to notice someone else using a link that was emailed
-- to a customer.
create table if not exists password_resets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  -- Hashed, never raw: the same privacy rule the rest of the schema
  -- follows for addresses.
  requested_ip    text,
  created_at      timestamptz not null default now()
);

create index if not exists password_resets_user_idx
  on password_resets (user_id, created_at desc);

-- Lets the nightly sweep find expired rows without a sequential scan.
create index if not exists password_resets_expiry_idx
  on password_resets (expires_at)
  where used_at is null;

-- ------------------------------------------------------- email_log
--
-- Every message attempted, whether it went or not.
--
-- idempotency_key is the important column. An order confirmation is
-- triggered by a request that can be retried -- a flaky connection, an
-- impatient second tap, a webhook delivered twice -- and a customer who
-- gets four copies of the same receipt trusts the shop less, not more.
-- The unique index makes the duplicate impossible rather than unlikely.
create table if not exists email_log (
  id              uuid primary key default gen_random_uuid(),
  to_email        text not null,
  subject         text not null,
  template        text not null,
  reference_type  text,
  reference_id    uuid,
  status          text not null default 'queued'
                    check (status in ('queued', 'sent', 'failed', 'skipped')),
  error           text,
  idempotency_key text unique,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists email_log_recent_idx
  on email_log (created_at desc);

create index if not exists email_log_failures_idx
  on email_log (created_at desc)
  where status = 'failed';

-- RLS on both: deny by default, like every other table here. Flask holds
-- the service key and bypasses this; it is a seatbelt for the day
-- something else gets a connection string.
alter table password_resets enable row level security;
alter table email_log       enable row level security;
