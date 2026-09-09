# Referral and wallet system

How a referral is captured, attributed, rewarded and — when it has to be —
reversed. Written against the code in this repository, not as a proposal.

---

## 1. Database schema

Five tables carry the programme. Full DDL is in
[`db/migrations/002_referral_wallet.sql`](../db/migrations/002_referral_wallet.sql).

### `users` (additions)

| Column | Type | Why |
|---|---|---|
| `referral_code` | `text unique not null` | Generated at signup, e.g. `PRIYA-K7M2Q`. Unique index is the guarantee. |
| `referred_by` | `uuid → users(id)` | Denormalised pointer for fast "who brought this customer" joins. |
| `wallet_balance` | `integer ≥ 0` | A **cache**. The ledger is the truth. Only ever moved under a row lock. |
| `signup_ip_hash` | `text` | `sha256(ip + pepper)`. Never the raw address. |
| `signup_device_id` | `text` | Salted browser fingerprint. Fraud heuristics only. |

### `referral_clicks` — link analytics

One row per visit to `/r/<CODE>`. Carries `visitor_token` (an anonymous
cookie id), the salted IP, UTM parameters, and `converted_user_id` once
that visitor registers. This is what makes clicks → signups → orders a
real funnel rather than a guess.

Indexes: `(code, created_at desc)`, `(referrer_id, created_at desc)`,
`(visitor_token)`, `(converted_user_id)`.

### `referrals` — one row per referred person, for life

```
referrer_id              uuid  not null → users(id)
referee_id               uuid  not null → users(id)  UNIQUE   ← the key constraint
code                     text  not null
click_id                 uuid  → referral_clicks(id)
status                   pending | qualified | rewarded | rejected | reversed

-- rules frozen at creation time
referee_discount_type    percent | fixed
referee_discount_value   numeric
referrer_points_config   integer
referee_points_config    integer

-- actuals, written when the order is paid
qualifying_order_id      uuid → orders(id)
referee_discount_applied numeric
referrer_points_awarded  integer

fraud_flags              jsonb        -- ["same_ip_as_referrer", …]
constraint no_self_referral check (referrer_id <> referee_id)
```

Two design decisions worth stating plainly:

- **`unique(referee_id)`** is what makes a person referable exactly once,
  ever. Not application logic — a constraint. A replayed signup, a
  double-submitted form and two racing workers all collide here.
- **Config is snapshotted onto the row.** Raising the reward tomorrow must
  not retroactively change what someone was promised today, and lowering
  it must not claw back a promise. The row remembers its own terms.

### `wallet_transactions` — append-only ledger

```
user_id          uuid not null
type             referral_reward | welcome_bonus | redeem | redeem_refund
                 | reversal | admin_credit | admin_debit | promo | …
points           integer        -- signed: + earns, − spends
balance_after    integer ≥ 0    -- checked, so a negative balance cannot be written
money_value      numeric
reference_type   'referral' | 'order' | 'manual'
reference_id     uuid
idempotency_key  text UNIQUE    ← at-most-once, enforced by the index
```

Nothing updates or deletes a ledger row. A correction is another row.

### `admin_settings` — the tunables

Key/value with `jsonb` values, plus the metadata the admin panel needs to
render a control for each one: `label`, `description`, `ui_control`,
`options`, `min_value`, `max_value`, `is_public`. Adding a tunable is an
`insert`, not a frontend change.

---

## 2. Workflow

### Step 1 — Click

`GET /r/PRIYA-K7M2Q` renders
[`ReferralCatch.jsx`](../frontend/src/pages/ReferralCatch.jsx), which:

1. writes `zion.ref = PRIYA-K7M2Q` and `zion.ref_at = <timestamp>` to
   `localStorage`;
2. `POST /api/referral/track/PRIYA-K7M2Q` with an anonymous
   `visitor_token` (a UUID minted once per browser), landing path,
   referrer URL and UTM parameters;
3. shows *who* invited them and *what they get*.

The endpoint answers `200` with `enabled: false` for an unknown code
rather than an error. **A broken link must never put an error page between
a visitor and the shop.**

Why `localStorage` and not a cookie: the storefront is a SPA on a
separate origin from the API in development, and the value has to survive
the walk from landing page → browsing → signup form. It is read once, at
registration, and deleted.

### Step 2 — Attribution, at registration

`POST /api/auth/register` runs **one transaction**
([`auth_controller.py`](../backend/controllers/auth_controller.py)):

```
BEGIN
  insert user (with a freshly generated, unique referral_code)
  attach_referral(cursor, new_user, code, visitor_token, ip_hash, device_hash)
    ├─ SELECT … FOR UPDATE on the referrer row
    ├─ run fraud heuristics  → flags[]
    ├─ INSERT INTO referrals … ON CONFLICT (referee_id) DO NOTHING
    ├─ UPDATE users SET referred_by = referrer
    ├─ UPDATE referral_clicks SET converted_user_id  (ties click → signup)
    └─ if no flags and welcome points configured:
         wallet_move(referee, +welcome, 'welcome_bonus',
                     idempotency_key = 'welcome:<referral_id>')
COMMIT
```

`attach_referral` **never raises for an ordinary bad code**. A mistyped or
abusive referral must not cost someone their account, so the whole call is
wrapped and failure simply means "no referral applied".

### Step 3 — Discount, at checkout

`quote_referee_discount(user_id, subtotal)` is a pure calculation. It
returns zero unless *all* of these hold:

- the programme is enabled;
- a referral row exists for this user with status `pending`/`qualified`
  and no `qualifying_order_id` yet;
- the user has **no prior paid order** (first order only);
- the subtotal clears `referral.referee_min_order`.

The discount uses the **snapshotted** type and value from the referral
row, capped by `referee_discount_max`, and never exceeds the subtotal.

Pricing order, in [`checkout_controller.py`](../backend/controllers/checkout_controller.py):

```
subtotal
  − coupon
  − referral discount
  − coins redeemed
  = taxable
  + shipping (free above the threshold)
  + GST on taxable
  = total
```

`/checkout/quote` and `/checkout/place` call **the same `_price()`
function**, so the number a customer is shown is the number they are
charged. Prices are re-read from `product_variants` inside the order
transaction — the client only ever names SKUs and quantities.

### Step 4 — Reward

`referral_service.on_order_paid(order_id)` is the trigger. It is called
from the admin marking an order paid or delivered, and would be called
from a payment webhook. It is safe to call any number of times.

```
BEGIN
  SELECT … FROM orders WHERE id = ? FOR UPDATE      -- two webhooks serialise here
  check qualify_on: 'order_paid' vs 'order_delivered'
  SELECT … FROM referrals WHERE referee_id = ? FOR UPDATE
  mark the order as the qualifying one; status pending → qualified

  if fraud_flags and not auto_approve_flagged  → stop. Held for review.
  if reward_hold_days > 0                      → stop. Paid later by the sweep.

  wallet_move(referrer, +points, 'referral_reward',
              idempotency_key = 'referral_reward:<referral_id>')
  status → rewarded
COMMIT
```

`reward_hold_days` exists to cover the returns window. Held referrals are
paid by `process_due_rewards()`, wired to a daily cron or the
**Pay due rewards** button in Admin → Referrals.

### Step 5 — Reversal

If the qualifying order is refunded or cancelled,
`on_order_reversed(order_id)` debits the referrer with idempotency key
`referral_reversal:<referral_id>` and sets status `reversed`. If the
referrer has already spent those points, the debit fails the
`balance_after >= 0` check — and **we take the loss**, recording the
reversal without forcing a negative balance. Chasing a customer for spent
loyalty points costs more goodwill than it recovers.

The referee's spent coins are separately returned on cancellation, keyed
`redeem_refund:<order_id>`.

---

## 3. Race conditions and fraud

### The concurrency argument

Every balance change goes through one Postgres function,
`wallet_move()`:

```sql
if p_idempotency_key is not null then
  select * into v_existing from wallet_transactions
    where idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;       -- replay: hand back the original
end if;

select wallet_balance into v_balance
  from users where id = p_user_id for update;    -- serialise concurrent writers

v_balance := v_balance + p_points;
if v_balance < 0 then raise exception …; end if;

insert into wallet_transactions (…, balance_after, idempotency_key) …;
update users set wallet_balance = v_balance where id = p_user_id;

exception when unique_violation then             -- lost the race on the index
  return the row the other writer wrote;
```

This is in the database rather than in Python deliberately. Two Gunicorn
workers handling a double-clicked "Place order" **cannot** interleave a
read-modify-write, because they serialise on the same row lock. The
unique index on `idempotency_key` is the backstop for the case where they
race past the lock entirely.

| Risk | Control |
|---|---|
| Double reward from a retried webhook | `idempotency_key = referral_reward:<id>`, unique index |
| Two workers crediting at once | `SELECT … FOR UPDATE` on `users` inside `wallet_move` |
| Double-clicked checkout | `idempotency_key = redeem:<order_id>` |
| Two signups for one referee | `unique(referee_id)` on `referrals` |
| Spending more than you hold | `check (balance_after >= 0)` + locked read |
| Coins spent, then order cancelled | Redemption is inside the order transaction; a failure rolls both back |

### Fraud controls, in layers

1. **`check (referrer_id <> referee_id)`** — a table constraint. The
   crudest self-referral cannot be stored at all.
2. **`guard_self_referral()` trigger** — rejects identical email or
   identical phone between referrer and referee, before insert.
3. **Normalised email comparison** — `p.riya+ref@gmail.com` and
   `priya@gmail.com` are the same inbox. Plus-addressing is stripped and
   dots removed for `gmail.com`/`googlemail.com`.
4. **IP and device heuristics** — `same_ip_as_referrer`,
   `same_device_as_referrer`. These **flag, they do not silently drop**.
   A real family sharing a router should not lose a reward without a
   human looking at it.
5. **Reward cap** — `referral.max_rewards_per_user` flags a referrer who
   has hit their limit.
6. **First-paid-order only** — the discount cannot be farmed across
   repeated orders, and COD orders reward on *delivered*, not *placed*.

Flagged referrals stop at `qualified` and wait in **Admin → Referrals →
Held for review**, where an administrator approves (pays immediately) or
rejects with a recorded reason. Every action lands in `audit_log`.

**Privacy note:** raw IP addresses are never stored. `hash_ip()` writes
`sha256(ip + PRIVACY_PEPPER)`, which answers "same network as before?"
without retaining the address itself.

---

## 4. Admin panel controls

All under **Admin → Settings**, generated from `admin_settings` rows.
The Referral and Wallet tabs each render a live worked example, so nobody
has to imagine what a number does — change the reward and the
"on a ₹1,499 order" panel updates as you type.

### Referral programme

| Setting | Key | Default | What it does |
|---|---|---|---|
| Programme is live | `referral.enabled` | `true` | Master switch. Earned points are untouched when off. |
| Discount type | `referral.referee_discount_type` | `percent` | Percentage, or a flat rupee amount. |
| Discount for the friend | `referral.referee_discount_value` | `10` | Read as % or ₹ per the type above. |
| Cap on the discount | `referral.referee_discount_max` | `300` | Ceiling in ₹ for a percentage. 0 removes it. |
| Minimum order | `referral.referee_min_order` | `499` | Subtotal needed before the discount applies. |
| Points for the referrer | `referral.referrer_points` | `200` | Credited when the friend's order qualifies. |
| Welcome points | `referral.referee_welcome_points` | `100` | Credited to the friend at signup. 0 disables. |
| When it counts | `referral.qualify_on` | `order_paid` | `order_paid` or `order_delivered`. |
| Hold reward for | `referral.reward_hold_days` | `0` | Days to wait, covering the returns window. |
| Max rewarded referrals | `referral.max_rewards_per_user` | `0` | Per referrer. 0 = unlimited. |
| Link lasts | `referral.cookie_days` | `30` | Attribution window after a click. |
| Flag same network | `referral.block_same_ip` | `true` | Hold for review on a shared IP. |
| Flag same device | `referral.block_same_device` | `true` | Hold for review on a matching fingerprint. |
| Pay flagged automatically | `referral.auto_approve_flagged` | `false` | Off means a human decides. |
| Share message | `referral.share_message` | — | `{discount}`, `{code}`, `{name}` are substituted. |

### Wallet

| Setting | Key | Default | What it does |
|---|---|---|---|
| Wallet is live | `wallet.enabled` | `true` | |
| What points are called | `wallet.coin_name` | `ZION Coins` | Used everywhere on the storefront. |
| **Coins per ₹1** | `wallet.coins_per_rupee` | `10` | **The redemption rate.** 10 ⇒ 2,000 coins = ₹200. |
| Minimum redemption | `wallet.min_redeem_points` | `500` | |
| Max share of an order | `wallet.max_redeem_percent` | `25` | Stops a whole order being paid in points. |
| Expiry | `wallet.points_expiry_days` | `365` | 0 = never. |

Rounding is deliberately asymmetric and always in the customer's favour:
points → rupees rounds **down** (`ROUND_DOWN`), rupees → points rounds
**up** (`ceil`). Neither direction can be exploited to mint value.

### Other referral screens

- **Admin → Referrals** — every referral, filterable by status, with a
  *Held for review* filter. Approve pays immediately; reject records a
  reason. **Pay due rewards** runs the hold sweep.
- **Admin → Customers** — balances, referral counts, "invited by", and a
  manual coin adjustment that requires a written reason and writes both a
  ledger row and an audit entry.
- **Admin → Overview** — coins outstanding with their rupee liability,
  top referrers by conversion, and a count of anything held for review.

---

## 5. Implementation reference

Real code, not pseudocode:

| Concern | File |
|---|---|
| Attribution, rewards, reversal, stats | [`backend/services/referral_service.py`](../backend/services/referral_service.py) |
| Ledger, conversions, redemption quote | [`backend/services/wallet_service.py`](../backend/services/wallet_service.py) |
| Atomic balance movement | `wallet_move()` in [`002_referral_wallet.sql`](../db/migrations/002_referral_wallet.sql) |
| Settings with caching | [`backend/services/settings_service.py`](../backend/services/settings_service.py) |
| Signup + attribution transaction | [`backend/controllers/auth_controller.py`](../backend/controllers/auth_controller.py) |
| Pricing and order placement | [`backend/controllers/checkout_controller.py`](../backend/controllers/checkout_controller.py) |
| Admin actions | [`backend/controllers/admin_controller.py`](../backend/controllers/admin_controller.py) |

### API surface

```
POST /api/referral/track/<code>     log a click, return who invited them
GET  /api/referral/preview/<code>   referrer name + offer, for the landing page
GET  /api/referral/me               the signed-in user's link, funnel and history
GET  /api/referral/quote?subtotal=  first-order discount for this basket
GET  /api/referral/config           public programme terms

GET  /api/wallet                    balance, value, lifetime earned/spent
GET  /api/wallet/history            the ledger
GET  /api/wallet/quote?subtotal=    how many coins are spendable here

POST /api/admin/referrals/<id>/approve
POST /api/admin/referrals/<id>/reject
POST /api/admin/referrals/process-due
POST /api/admin/customers/<id>/wallet     manual adjustment
PUT  /api/admin/settings                  change any tunable
```

### Things deliberately left out

- **Points expiry is configured but not swept.** `wallet.points_expiry_days`
  is stored and `wallet_transactions.expires_at` exists, but no job expires
  them yet. Add it to the same cron as `process_due_rewards()`.
- **No payment webhook.** `on_order_paid()` is written to be called by one
  and is idempotent, but the Razorpay handler itself is not built —
  orders are marked paid from the admin panel today.
- **Multi-level referrals.** The schema does not model a chain. Deliberate:
  it takes the programme somewhere that needs legal review in India.
