#!/usr/bin/env bash
#
# Build the production upload.
#
# Produces build-out/zion/ and an archive of it. What lands on the server
# is exactly this and nothing else: the built frontend, the backend
# source, the nginx and systemd units, and the installer.
#
# Deliberately left out:
#   db/          the tables already exist in Supabase. The migrations are
#                repo history, not server files. seed.py says so if it is
#                ever run without them.
#   tests/       needs a live database and dev dependencies.
#   render.yaml  a different hosting target.
#   .env         secrets never travel in the tarball. The installer
#                writes it on the server from .env.production.example.
#
# Usage:  bash deploy/package.sh
#
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/build-out"
stage="$out/zion"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ----------------------------------------------------------- frontend
say "Building the frontend"
cd "$root/frontend"
npm run build

# ------------------------------------------------------------- stage
say "Assembling $stage"
rm -rf "$stage"
mkdir -p "$stage/deploy"

cp -r "$root/frontend/dist" "$stage/dist"

# Backend source. The excludes are the point of using tar over cp here.
tar -c -C "$root" \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.env' \
    --exclude='backend/tests' \
    --exclude='backend/render.yaml' \
    backend | tar -x -C "$stage"

cp "$root/deploy/deploy.sh" "$root/deploy/nginx.conf" \
   "$root/deploy/zion-api.service" "$stage/deploy/"
cp "$root/deploy/install.sh" "$stage/install.sh"
cp "$root/docs/production.md" "$stage/README-DEPLOY.md"

chmod +x "$stage/install.sh" "$stage/deploy/deploy.sh" 2>/dev/null || true

# A tarball that carried a .env would hand over the database. Cheap to
# check, and the one mistake here that cannot be taken back.
if find "$stage" -name '.env' -o -name '*.key' -o -name '*.pem' | grep -q .; then
  echo "refusing to package: a secret file is staged" >&2
  exit 1
fi

# ---------------------------------------------------------- archives
say "Writing archives"
cd "$out"
rm -f zion-production.tar.gz zion-production.zip
tar -czf zion-production.tar.gz zion

if command -v zip >/dev/null 2>&1; then
  zip -qr zion-production.zip zion
elif command -v powershell.exe >/dev/null 2>&1; then
  # Git Bash on Windows has tar but no zip.
  powershell.exe -NoProfile -Command \
    "Compress-Archive -Path 'zion' -DestinationPath 'zion-production.zip' -Force" >/dev/null
else
  echo "note: no zip tool found, tarball only"
fi

# ------------------------------------------------------------ report
say "Done"
printf '%s files\n' "$(find "$stage" -type f | wc -l | tr -d ' ')"
ls -lh zion-production.* | awk '{printf "  %-26s %s\n", $9, $5}'
