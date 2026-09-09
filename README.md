# ZION Herbs

E-commerce for a Tamil Nadu herbal tea brand. Six single-origin infusions
and two gift sets, with a referral programme, a coin wallet, and an admin
panel that owns the design as well as the data.

**Flask + Supabase (Postgres) + React + Vite + Tailwind.**

---

## Running it

### 1. Database

Create a Supabase project, then from **Project settings → Database →
Connection string → URI (session pooler)** copy the connection string.

```bash
cd backend
python -m venv venv
source venv/Scripts/activate        # Git Bash on Windows
pip install -r requirements.txt

cp .env.example .env
```

Fill in `.env` — at minimum `DATABASE_URL`, `JWT_SECRET`,
`PRIVACY_PEPPER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Generate the secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Check everything before you run anything:

```bash
python setup_check.py
```

It validates every value, actually connects to the database, and tells you
what to fix rather than what went wrong. When it says **Ready**, build the
schema and load the catalogue:

```bash
python seed.py
```

That runs the four migrations, seeds eight products with fourteen SKUs,
twelve FAQs and every admin setting, and creates your admin account.
It is safe to re-run. `python seed.py --reset` drops everything first.

### 2. API

```bash
python app.py        # http://localhost:5000
```

Check it: `curl http://localhost:5000/api/health`

With the API running, prove the referral programme works end to end:

```bash
python tests/test_referral_flow.py
```

And schedule the daily job (Task Scheduler or cron):

```bash
python maintenance.py            # pays due rewards, expires stale points
python maintenance.py --dry-run  # report only
```

### 3. Storefront

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Vite proxies `/api` to port 5000, so nothing needs configuring.

**The storefront runs without the backend.** If the API is unreachable it
falls back to `src/data/catalog.js`, a local mirror of the seed data, so
the site is developable before Supabase is connected. Signing in, the
wallet and checkout need the API.

| | |
|---|---|
| Shop | http://localhost:5173 |
| Sign in | http://localhost:5173/signin |
| Admin | http://localhost:5173/admin |

---

## What is here

```
backend/
  app.py                    Flask entrypoint, CORS, error handling
  db.py                     psycopg 3 pool; transaction() is the important one
  config.py                 env, validated at boot
  controllers/              auth · catalog · checkout · referral · wallet
                            · content · admin · seo
  services/                 referral · wallet · settings
  utils/                    auth guards, hashing, helpers
  controllers/payment_controller.py   Razorpay orders + signed webhook
  controllers/media_controller.py     uploads to Supabase Storage
  seed.py                   migrations + seed + admin account
  setup_check.py            pre-flight doctor for .env and the database
  maintenance.py            daily job: due rewards, point expiry
  tests/test_referral_flow.py  58-check end-to-end test

db/
  migrations/001_core.sql             users, catalog, cart, orders
  migrations/002_referral_wallet.sql  referrals, ledger, wallet_move()
  migrations/003_cms_seo.sql          themes, sections, FAQs, locations
  migrations/004_rls.sql              row-level security
  seed.sql, seed_products.sql

frontend/src/
  pages/                    storefront + auth + checkout
  admin/                    the panel — schema-driven CRUD
  components/               header, footer, cart, chat dock, SEO
  context/StoreProvider     settings/theme, auth, cart, catalogue
  data/catalog.js           offline fallback

docs/referral-system.md     schema, workflow, fraud controls, admin fields
```

### Why psycopg, not the Supabase client

The referral and wallet paths need `SELECT … FOR UPDATE` and real
transactions. The Supabase REST API cannot express either. So Supabase is
used as Postgres and object storage, and the API speaks SQL to it
directly. RLS is still enabled with a deny-by-default posture
(`004_rls.sql`) as a seatbelt, not as the authorisation model — the API
holds the service role key and authorises in code.

---

## The referral programme

Full detail in **[docs/referral-system.md](docs/referral-system.md)**.
In short:

1. Every account gets a link like `/r/PRIYA-K7M2Q` at registration.
   Clicks are tracked.
2. A friend registers through it. A `referrals` row snapshots the current
   rules, so later changes cannot rewrite what they were promised.
3. Their **first paid order** gets the referee discount.
4. That payment credits the referrer's wallet in coins.
5. Coins convert to rupees off a future order at an admin-set rate.

Every number — discount, points, conversion rate, minimums, caps — is a
row in `admin_settings`, editable under **Admin → Settings**, never a
constant in code.

**Safety.** Points move only through `wallet_move()`, a Postgres function
that takes a row lock on the user, refuses duplicate idempotency keys, and
cannot write a negative balance. Self-referral is blocked by a table
constraint, a trigger on email/phone, and normalised email comparison;
shared IP or device raises a flag for a human rather than silently
dropping the referral.

---

## Design

The palette and type come from the brand's own assets: the ZION logo, the
gold-foil posters, and the six brewed colours.

| Token | Value | |
|---|---|---|
| `--c-paper` | `#FCFBF9` | ground |
| `--c-surface` | `#EEEFE9` | raised, with a faint tea-leaf green bias |
| `--c-ink` | `#171310` | text |
| `--c-gold` | `#8F7222` | accent, dark enough to read as text |
| `--c-gold-lit` | `#C8A44D` | fills and rules only |

Type is **Marcellus** (display), **Jost** (body) and **Italianno**, used
in exactly one role, mirroring the script on the packaging.

Each product carries its own accent (`#2B3F8C` butterfly pea, `#9E1B32`
hibiscus, and so on), applied as a CSS custom property so a product page
takes on the colour of the tea in the cup. The saturated value is for
fills; a darkened twin is used for text, because chamomile amber is
unreadable as body copy on white.

Every colour resolves to a CSS custom property, never a literal — which
is what lets **Admin → Design studio** restyle the live site by writing
token values, with no rebuild. That screen also checks contrast ratios as
you edit and tells you when a choice drops below 4.5:1.

---

## SEO, AEO and GEO

- **Static JSON-LD** for Organization and LocalBusiness in `index.html`,
  so it is in the raw HTML for crawlers that do not run JavaScript.
- **Per-route** Product and FAQPage schema injected by `<Seo />`. FAQ
  answers in the schema are the same strings rendered on the page —
  mismatched schema reads as cloaking.
- **`/llms.txt`** — a plain-text brand and product brief written for
  language models, generated from the same database rows the site renders
  so it cannot drift out of date.
- **`/robots.txt`** — explicitly welcomes GPTBot, ClaudeBot,
  PerplexityBot and friends, toggleable from settings.
- **`/sitemap.xml`** — built from live products and pages.
- **GEO** — `locations` carries service areas (Chennai, Coimbatore,
  Madurai, Tiruchirappalli, Salem) that feed the local schema, and the
  content names real places and real Tamil botanicals rather than
  generic wellness copy.

---

## Payments

Cash on delivery and WhatsApp ordering work with no keys at all. For cards
and UPI, add to `.env`:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxx
```

then switch **Razorpay checkout** on under Admin → Settings → Shop.

Point the Razorpay dashboard webhook at
`https://your-api/api/payments/razorpay/webhook` and subscribe to
`payment.captured`, `payment.failed` and `refund.processed`.

Two paths confirm a payment and both are idempotent: the browser callback
(`/verify`, signature checked against the key secret) and the webhook
(signature checked over the **raw** body). The webhook is authoritative —
Razorpay retries it until it gets a 2xx. Either path marks the order paid,
which is what releases the referrer's reward.

The amount always comes from our own `orders` row, never from the request,
so a tampered client cannot pay less than the order is worth.

## Image uploads

Optional. With `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` set, and a public
bucket named by `SUPABASE_BUCKET` (default `zion-media`), the API accepts
uploads at `POST /api/admin/media`. Files are validated by sniffing magic
bytes rather than trusting the filename, capped at 8 MB, and stored under a
generated name so an upload cannot overwrite anything or escape the bucket.

Without it, every image field still accepts a URL.

---

## Deploying

Full guide in **[docs/deploy.md](docs/deploy.md)**.

**Vercel can host the frontend but not the API.** The API keeps a
connection pool and runs multi-statement transactions with
`SELECT ... FOR UPDATE`; serverless functions cannot hold either. Frontend
on Vercel, API on Render (`backend/render.yaml` is ready to use).

For a quick demo you can skip the API entirely: deploy only the frontend
with **no** environment variables. The storefront falls back to the local
catalogue and the admin panel has a built-in demo mode, so the whole site
is browsable. Sign-in and ordering need the API.

---

## Status

Verified on **9 September 2026** against a real PostgreSQL 16.6 instance,
by running the migrations, the seed, the API and a 58-check end-to-end
test of the referral programme.

**Verified working**

- `python setup_check.py` — validates .env, connects, reports what to fix.
- `python seed.py` — migrations + seed + admin account, from empty to ready.
- Running the entire setup **twice** produces identical row counts.
- `python app.py` — API boots, `/api/health` reports the database connected.
- `python tests/test_referral_flow.py` — **58 passed, 0 failed**, covering
  signup, attribution, the discount, checkout pricing, coin redemption,
  the reward, double-pay attempts, refund clawback, the flagged-referral
  review queue, and the public SEO surfaces.
- Razorpay webhook signature verification: a forged or missing signature
  is rejected with 400; a valid one is processed.
- Frontend builds clean (`npm run build`).

**Bugs this verification found and fixed**

| | |
|---|---|
| `004_rls.sql` failed outside Supabase | `anon`/`authenticated` are Supabase roles; now created if absent |
| `seed_products.sql` would not run at all | jsonb columns need explicit casts in a `VALUES` list |
| Re-running the seed duplicated data | `on conflict do nothing` is a no-op without a unique constraint |
| `wallet_move()` "does not exist" | psycopg sent a float as `double precision`; numeric needs an explicit cast |
| **Coins were never applied at checkout** | the "use my coins" box sent `undefined`, which the server read as zero |
| Redemption could exceed its cap | the cap rounded coins up; it now rounds down |
| Approving a flagged referral shorted the friend | it paid the referrer but never released the withheld welcome bonus |

**Also verified**

- **Razorpay checkout** — the storefront opens the Razorpay modal, verifies
  the signed result server-side, and handles a dismissed modal (order kept,
  unpaid) and a paid-but-unconfirmed payment (tells the customer not to pay
  again; the webhook settles it). The checkout only offers methods the
  server says are live, so with no keys the card option is hidden.
- **Admin image uploads** — drag-and-drop or file picker, plus a library to
  reuse an existing image. The URL box is always present, because Supabase
  Storage is optional and without it that is the only route.

**Still not built**

- Email. No receipts or shipping notifications are sent.

**Placeholders to replace**

- Prices (₹279–₹1,499) are my invention. Send the real ones and I will reseed.
- `zionherbs.in`, `hello@zionherbs.in`. The WhatsApp number
  (+91 63840 13131) is real, taken from the posters.

**Demo mode** — `frontend/src/data/demo.js` ships in the production bundle
(~24 KB) so anyone can walk the admin panel without a backend. Say the word
and I will put it behind an env flag before launch.
