#!/usr/bin/env bash
# Deploy ZION. Run on the server as the zion user.
#
#   cd /var/www/zion && ./deploy/deploy.sh
#
# Safe to re-run. The frontend is built aside and swapped in, so a failed
# build never leaves the site half-replaced, and a failed API restart
# rolls the frontend back to the version that was serving a moment ago.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/frontend"
cd "$ROOT"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*"; exit 1; }

say "Pulling"
git pull --ff-only

say "Backend dependencies"
./venv/bin/pip install -q -r backend/requirements.txt

# Stops a deploy that would boot into a broken configuration, rather than
# finding out from the health check after the old build is gone.
say "Checking configuration"
( cd backend && "$ROOT/venv/bin/python" setup_check.py )

say "Database migrations"
( cd backend && "$ROOT/venv/bin/python" seed.py --migrate )

say "Building the frontend"
cd "$WEB"
npm ci --silent
rm -rf dist.new dist.old
npm run build -- --outDir dist.new
[ -f dist.new/index.html ] || fail "Build produced no index.html — stopping, site untouched."

# The swap. Two renames, so the window where dist is missing is as close
# to zero as a filesystem allows.
[ -d dist ] && mv dist dist.old
mv dist.new dist
cd "$ROOT"

say "Restarting the API"
sudo systemctl restart zion-api

say "Checking it came back"
up=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
    up=1; break
  fi
  sleep 1
done

if [ "$up" -ne 1 ]; then
  say "API did not come back — rolling the frontend back"
  if [ -d "$WEB/dist.old" ]; then
    rm -rf "$WEB/dist"
    mv "$WEB/dist.old" "$WEB/dist"
  fi
  fail "Deploy aborted. Previous frontend restored. Check: journalctl -u zion-api -n 50"
fi
echo "  API is up"

say "Reloading nginx"
sudo nginx -t
sudo systemctl reload nginx

rm -rf "$WEB/dist.old"
say "Done"
