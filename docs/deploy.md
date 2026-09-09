# Deploying a demo

Two ways, depending on what you need to show.

---

## Can Vercel host all of it?

**The frontend, yes — it is an ideal fit. The API, no.**

Vercel is serverless: every request runs in a fresh, short-lived function.
The API holds a psycopg connection pool and does multi-statement
transactions with `SELECT … FOR UPDATE` for the wallet. On serverless that
breaks in two ways:

- Connections cannot be pooled between invocations, so a burst of traffic
  opens a burst of Postgres connections and exhausts Supabase's budget.
- Supabase's transaction-mode pooler, the one built for serverless, does
  not support the session-level features psycopg uses by default.

It can be forced to work. It is not worth doing for a demo.

---

## Option A — Frontend only, no backend

**Five minutes, free, nothing to configure.** Best for showing someone the
design and the admin panel.

The storefront falls back to `src/data/catalog.js` when the API is
unreachable, and the admin panel has a built-in demo mode. So a
frontend-only deploy is a complete, browsable site.

```bash
npm i -g vercel
cd frontend
vercel            # preview URL
vercel --prod     # production URL
```

Set **no** environment variables. Without `VITE_API_URL` the app calls
`/api` on its own domain, gets nothing, and quietly uses the offline
catalogue.

Visitors can browse the shop, open products, use the tea guide, and click
**Open the admin demo** on the sign-in page to walk the whole panel.

What will not work: real sign-in, real orders, anything that writes.

---

## Option B — Real, end to end

Frontend on Vercel, API on Render, database already on Supabase.

### 1. API on Render

Push to GitHub, then in Render: **New → Blueprint**, point at
`backend/render.yaml`. Or **New → Web Service** with:

| | |
|---|---|
| Root directory | `backend` |
| Build | `pip install -r requirements.txt` |
| Start | `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 60` |
| Health check | `/api/health` |

Set these in the Render dashboard — never in the repo:

```
FLASK_ENV=production
DATABASE_URL=<Supabase Session pooler URI, port 5432>
JWT_SECRET=<the one from your .env>
PRIVACY_PEPPER=<the one from your .env>
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
SUPABASE_BUCKET=zion-media
CORS_ORIGINS=https://<your-app>.vercel.app
PUBLIC_SITE_URL=https://<your-app>.vercel.app
```

Use the **same** `JWT_SECRET` and `PRIVACY_PEPPER` as local. A different
`JWT_SECRET` invalidates every existing session; a different
`PRIVACY_PEPPER` silently breaks the shared-IP fraud check, because old
hashes stop matching new ones.

Keep `--workers 2`. Each worker opens its own connection pool, and the
free Supabase tier has a finite connection budget.

### 2. Frontend on Vercel

```bash
cd frontend
vercel --prod
```

Set one environment variable in the Vercel dashboard:

```
VITE_API_URL=https://<your-api>.onrender.com/api
```

It must end in `/api` and have no trailing slash. Redeploy after setting
it — Vite bakes environment variables in at build time, so changing it in
the dashboard does nothing until the next build.

### 3. Close the loop

`CORS_ORIGINS` on Render must contain the exact Vercel URL, scheme
included. Get this wrong and every API call fails in the browser with a
CORS error while `curl` works perfectly — which is a confusing hour if you
are not expecting it.

Then check:

```
https://<your-api>.onrender.com/api/health   -> {"database":"connected"}
```

---

## Things worth knowing

**Render free tier sleeps.** After 15 minutes idle the service spins down,
and the next request takes 30–60 seconds. For a demo, open the API health
URL a minute before showing anyone.

**The SEO routes live on the API.** `/sitemap.xml`, `/robots.txt` and
`/llms.txt` are served by Flask, so on the Vercel domain they return the
SPA instead. Fine for a demo. For production, either serve the site from
one domain via a reverse proxy, or add explicit Vercel rewrites:

```json
{ "source": "/sitemap.xml", "destination": "https://<your-api>.onrender.com/sitemap.xml" }
```

**Never put a secret in a `VITE_` variable.** Anything so prefixed is
compiled into the JavaScript bundle and is public forever. The service
role key bypasses every row-level security policy. The frontend needs
exactly one variable: `VITE_API_URL`.

**Demo mode ships in the production bundle** (~24 KB), which is what makes
Option A possible. Before a real launch, put it behind a flag or remove
`frontend/src/data/demo.js` and the `isDemo()` branches.

**Point Razorpay's webhook at the API, not the frontend:**
`https://<your-api>.onrender.com/api/payments/razorpay/webhook`
