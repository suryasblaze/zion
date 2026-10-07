# Production deployment

One Ubuntu server running nginx and gunicorn, with Supabase as the
database. Everything is served from a single origin: nginx hands out the
built React files and proxies `/api` to gunicorn.

That choice matters more than it looks. It means no CORS in the browser
at all, and it puts `/sitemap.xml`, `/robots.txt` and `/llms.txt` — which
Flask generates from live product rows — on the same domain as the shop,
which is where crawlers look for them.

```
         ┌──────── nginx :443 ────────┐
 user ──▶│  /            → dist/      │
         │  /api/        → :5000      │──▶ gunicorn ──▶ Supabase
         │  /sitemap.xml → :5000      │     (3 workers)
         └────────────────────────────┘
```

---

## 1. Server

A 1 GB VPS is enough. Ubuntu 22.04 or 24.04.

```bash
sudo apt update && sudo apt install -y nginx python3-venv python3-pip git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo adduser --system --group --home /var/www/zion zion
sudo mkdir -p /var/www/zion && sudo chown zion:zion /var/www/zion
```

## 2. Code

Two ways, and the second is lighter.

**Clone on the server** — one command per deploy afterwards, but the box
needs Git and Node.

```bash
sudo -u zion -H bash
cd /var/www/zion
git clone https://github.com/suryasblaze/zion.git .
python3 -m venv venv
./venv/bin/pip install -r backend/requirements.txt
```

**Or build locally and upload.** The server then needs **no Node.js at
all** — nginx only ever serves files that are already built.

```bash
# on your machine
cd frontend && npm run build
scp -r dist/*  zion@server:/var/www/zion/dist/
scp -r backend zion@server:/var/www/zion/
```

```bash
# on the server, once
cd /var/www/zion
python3 -m venv venv
./venv/bin/pip install -r backend/requirements.txt
```

### What the server actually needs

```
/var/www/zion/
├── dist/        the built frontend (~8 MB)
├── backend/     the API
└── venv/        created on the server, never copied
```

`db/` is **not** required. Only `seed.py` reads it, and only when
migrating or seeding — which you do once, from wherever the schema is
applied. The API, `setup_check.py`, `maintenance.py` and
`seed.py --admin` never touch those files. Run `seed.py` without them and
it tells you so rather than failing obscurely.

Copy `db/` across only when a new migration lands, or paste the migration
into the Supabase SQL editor instead.

Never copy: `node_modules/`, `frontend/src/`, `__pycache__/`, `tea/`, a
local `venv/` (a Windows one will not run on Linux), or `.env` — write
that on the server.

## 3. Configuration

```bash
cp backend/.env.production.example backend/.env
nano backend/.env          # fill it in
chmod 600 backend/.env     # it holds the service key and DB password
```

Reuse the `JWT_SECRET` and `PRIVACY_PEPPER` you already have. A new JWT
secret signs every existing session out; a new pepper silently breaks the
shared-IP fraud check, because hashes written before the change stop
matching ones written after.

Then prove it before going further:

```bash
cd backend && ../venv/bin/python setup_check.py
```

It connects to Supabase and reports what is missing. Only continue on
**Ready**.

## 4. Database

If the schema is not applied yet, and `db/` is present:

```bash
../venv/bin/python seed.py        # migrations + seed + admin account
```

Safe to re-run; on an existing database it applies only what is new.

If the schema is **already** applied — the usual case, because it was set
up from a developer machine — you only need the admin account, and that
needs no SQL files:

```bash
../venv/bin/python seed.py --admin
```

## 5. Frontend

Only if you are building on the server:

```bash
cd /var/www/zion/frontend
npm ci
npm run build
```

No environment variables. The app calls `/api` on its own origin, which
nginx proxies. If you uploaded `dist/` instead, there is nothing to do
here.

nginx's `root` is `/var/www/zion/dist`. Put the build anywhere else and
change that line, or you get a 403 and a blank page.

## 6. The API as a service

```bash
sudo cp deploy/zion-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zion-api
sudo systemctl status zion-api
```

Gunicorn binds `127.0.0.1:5000` — loopback only, so nothing but nginx can
reach it.

**On worker count.** Three workers x four threads handles far more than a
tea shop will see. Keep workers low: each opens its own Postgres pool, and
`workers x pool.max_size` has to stay under Supabase's connection limit.
Raising workers to 8 without lowering the pool is how you exhaust it.

## 7. nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/zion
sudo ln -s /etc/nginx/sites-available/zion /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

The rate-limit zones live in `http{}`, not the server block:

```bash
sudo tee /etc/nginx/conf.d/zion-limits.conf >/dev/null <<'EOF'
limit_req_zone $binary_remote_addr zone=zion_api:10m   rate=30r/m;
limit_req_zone $binary_remote_addr zone=zion_auth:10m  rate=10r/m;
limit_req_zone $binary_remote_addr zone=zion_write:10m rate=6r/m;
EOF

sudo nginx -t && sudo systemctl reload nginx
```

## 8. HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d zionherbs.in -d www.zionherbs.in
sudo systemctl status certbot.timer     # renewal is automatic
```

## 9. Daily job

```bash
sudo -u zion crontab -e
```

```
0 3 * * * cd /var/www/zion/backend && /var/www/zion/venv/bin/python maintenance.py >> /var/log/zion-maintenance.log 2>&1
```

Pays referral rewards past their hold and expires stale wallet points.
Both are idempotent, so a double run is harmless.

## 10. Firewall

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

---

## Deploying a change

**If you cloned on the server:**

```bash
cd /var/www/zion && ./deploy/deploy.sh
```

Pulls, installs, checks the configuration, migrates, builds the frontend
**aside** and swaps it in, restarts the API, and waits for the health
check. If the API does not come back it restores the previous frontend
and stops. A failed build never leaves a half-replaced site.

---

## What makes it fast

**The admin panel is not in the shop's bundle.** It loads on demand, so
someone buying tea downloads ~94 KB gzipped instead of ~123 KB. The admin
chunks (~93 KB) are fetched only when `/admin` is opened.

**React and the router are split out.** A release that touches only shop
code leaves them cached in everyone's browser.

**Assets are immutable for a year.** Filenames carry a content hash, so
they can never go stale. `index.html` is explicitly `no-cache` — without
that, a deploy leaves people on an old page pointing at asset hashes that
no longer exist, and the site white-screens until they hard-refresh.

**Images were already optimised**: the 2.5 MB source posters ship at
~200 KB as WebP with JPEG fallbacks.

Worth doing when traffic justifies it, roughly in order:

- Build nginx with `ngx_brotli`. Beats gzip by about 15% on text.
- Put Cloudflare in front. Free, and moves static bytes off the box.
- `pgbouncer` locally if you ever outgrow Supabase's pooler.

---

## Checking it afterwards

```bash
curl -I  https://zionherbs.in                      # 200, HSTS present
curl -s  https://zionherbs.in/api/health           # database: connected
curl -s  https://zionherbs.in/llms.txt | head      # Flask, same origin
curl -sI https://zionherbs.in/assets/ -o /dev/null # immutable cache header

sudo journalctl -u zion-api -f
sudo tail -f /var/log/nginx/zion.access.log
```

Sign in at `/signin`, open `/admin`, and place a test order with cash on
delivery. Mark it paid and confirm the referral reward fires.

---

## Things that will bite

**`index.html` must not be cached.** Covered above, and the single most
common cause of "the site broke after deploying".

**Razorpay's webhook needs the public URL**, not localhost:
`https://zionherbs.in/api/payments/razorpay/webhook`. Without
`RAZORPAY_WEBHOOK_SECRET` set, payments only confirm on the browser
callback — so a customer who closes the tab mid-payment stays unpaid.

**The service key must never reach the frontend.** It bypasses every
row-level security policy. The frontend needs no environment variables
at all; anything named `VITE_*` is compiled into public JavaScript.

**Supabase free projects pause after inactivity.** A paused project stops
resolving in DNS and the API cannot start. On a paid plan this does not
happen; on free, check it before an event.

**Back up before you need to.** Supabase does daily backups on paid
plans. On free, take your own:

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f zion-$(date +%F).dump
```
