#!/usr/bin/env bash
# =====================================================================
# ZION Herbs -- first-time install on a fresh server.
#
#   tar xzf zion-production.tar.gz -C /var/www/zion
#   cd /var/www/zion && ./install.sh
#
# Creates the virtualenv, installs every Python dependency, writes the
# systemd unit and the nginx site, and then stops and tells you to fill
# in .env. It does not start anything until the configuration checks out
# -- booting into a broken config and reading the logs afterwards is a
# worse first experience than being told what is missing.
#
# Safe to re-run.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32mok\033[0m  %s\n' "$*"; }
warn() { printf '  \033[33m--\033[0m  %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n\n' "$*"; exit 1; }

# ---------------------------------------------------------- what is here
[ -d backend ] || die "No backend/ folder here. Run this from the folder you unpacked into."
[ -d dist ]    || warn "No dist/ folder — the frontend will 404 until you copy the build in."

# ------------------------------------------------------------ python
say "Python"
command -v python3 >/dev/null || die "python3 is not installed.  sudo apt install -y python3 python3-venv"
PYV="$(python3 -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
case "$PYV" in
  3.1[0-9]|3.9) ok "python $PYV" ;;
  *) warn "python $PYV — tested on 3.10 to 3.13; it may still be fine" ;;
esac

python3 -c 'import venv' 2>/dev/null || die "The venv module is missing.  sudo apt install -y python3-venv"

say "Virtual environment and dependencies"
[ -d venv ] || python3 -m venv venv
./venv/bin/python -m pip install --quiet --upgrade pip
./venv/bin/pip install --quiet -r backend/requirements.txt
ok "installed: $(./venv/bin/pip list --format=freeze | wc -l) packages"

# psycopg's binary wheel bundles libpq. If it is missing, every database
# call fails at runtime rather than here, so prove it imports now.
./venv/bin/python - <<'PY' || die "A dependency did not import — see the error above."
import importlib
for m in ("flask","flask_cors","psycopg","psycopg_pool","jwt","argon2","dotenv","requests"):
    importlib.import_module(m)
print("  ok  every dependency imports")
PY

# ------------------------------------------------------------- .env
say "Configuration"
if [ -f backend/.env ]; then
  ok ".env is present"
  chmod 600 backend/.env
else
  cp backend/.env.production.example backend/.env
  chmod 600 backend/.env
  warn "A blank .env has been written to backend/.env"
  cat <<'MSG'

  Fill it in before going further. At minimum:

    DATABASE_URL     Supabase > Database > Connection string > URI
                     Use the SESSION POOLER on port 5432, not the direct
                     connection: that host has no IPv4 record and will
                     not resolve from a server.
    JWT_SECRET       reuse the value already in use, or every existing
                     session is signed out
    PRIVACY_PEPPER   reuse it, or the shared-IP fraud check silently
                     stops matching
    ADMIN_EMAIL      the account you will sign in with
    ADMIN_PASSWORD   10 characters or more

  Generate a secret:
    python3 -c "import secrets; print(secrets.token_urlsafe(48))"

  Then run this script again.

MSG
  exit 0
fi

say "Checking the configuration against the live database"
( cd backend && "$ROOT/venv/bin/python" setup_check.py ) \
  || die "Fix the items above, then run ./install.sh again."

say "Admin account"
( cd backend && "$ROOT/venv/bin/python" seed.py --admin )

# -------------------------------------------------------- system files
if [ "$(id -u)" = 0 ] || sudo -n true 2>/dev/null; then
  say "systemd service"
  if [ -f deploy/zion-api.service ]; then
    sudo cp deploy/zion-api.service /etc/systemd/system/zion-api.service
    sudo systemctl daemon-reload
    sudo systemctl enable zion-api >/dev/null 2>&1 || true
    sudo systemctl restart zion-api
    ok "zion-api installed and started"
  else
    warn "deploy/zion-api.service not found — skipping"
  fi

  say "nginx"
  if [ -f deploy/nginx.conf ] && command -v nginx >/dev/null; then
    sudo tee /etc/nginx/conf.d/zion-limits.conf >/dev/null <<'LIMITS'
limit_req_zone $binary_remote_addr zone=zion_api:10m   rate=30r/m;
limit_req_zone $binary_remote_addr zone=zion_auth:10m  rate=10r/m;
limit_req_zone $binary_remote_addr zone=zion_write:10m rate=6r/m;
LIMITS
    sudo cp deploy/nginx.conf /etc/nginx/sites-available/zion
    sudo ln -sf /etc/nginx/sites-available/zion /etc/nginx/sites-enabled/zion
    sudo rm -f /etc/nginx/sites-enabled/default
    if sudo nginx -t 2>/dev/null; then
      sudo systemctl reload nginx
      ok "nginx configured and reloaded"
    else
      warn "nginx -t failed. The certificate paths in the config must exist first:"
      warn "  sudo certbot --nginx -d yourdomain.com"
    fi
  else
    warn "nginx not installed, or deploy/nginx.conf missing — skipping"
  fi
else
  warn "No sudo — skipped systemd and nginx. Run those steps as root:"
  warn "  sudo cp deploy/zion-api.service /etc/systemd/system/ && sudo systemctl enable --now zion-api"
  warn "  sudo cp deploy/nginx.conf /etc/nginx/sites-available/zion"
fi

# ------------------------------------------------------------- verify
say "Checking the API answers"
up=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:5000/api/health >/dev/null 2>&1; then up=1; break; fi
  sleep 1
done

if [ "$up" = 1 ]; then
  ok "API is up: $(curl -s http://127.0.0.1:5000/api/health)"
else
  warn "The API did not answer on 127.0.0.1:5000"
  warn "  sudo journalctl -u zion-api -n 40 --no-pager"
fi

say "Done"
cat <<'NEXT'
  Next:
    HTTPS      sudo certbot --nginx -d yourdomain.com
    daily job  crontab -e
               0 3 * * * cd /var/www/zion/backend && /var/www/zion/venv/bin/python maintenance.py >> /var/log/zion-maintenance.log 2>&1
    logs       sudo journalctl -u zion-api -f

  Then sign in at https://yourdomain.com/signin and open /admin.
NEXT
