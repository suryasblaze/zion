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
mkdir -p "$stage"

cp -r "$root/frontend/dist" "$stage/dist"

# Backend source. The excludes are the point of using tar over cp here.
# Archives are excluded because a hand-made backend.zip living in
# backend/ ships a copy of the backend inside the backend -- harmless,
# confusing, and it grows every time someone makes another one.
tar -c -C "$root" \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.env' \
    --exclude='*.zip' \
    --exclude='*.tar.gz' \
    --exclude='backend/tests' \
    --exclude='backend/render.yaml' \
    backend | tar -x -C "$stage"

# install.sh, with the nginx site and the systemd unit inlined in place
# of the block that reads deploy/. The server keeps dist/ and backend/
# and nothing else: those two files belong in /etc once installed, and a
# second copy sitting in the web root only invites editing the one that
# is not live. deploy.sh is left out too -- it does `git pull` and builds
# in frontend/, neither of which exists in an uploaded tarball.
awk -v svc="$root/deploy/zion-api.service" -v ngx="$root/deploy/nginx.conf" '
  /^# -+ config sources BEGIN$/ { skip = 1
    print "# --------------------------------- config sources (inlined)"
    print "# Written by deploy/package.sh from deploy/zion-api.service"
    print "# and deploy/nginx.conf. Edit those, not this."
    print "emit_service() { cat <<'\''ZION_SERVICE_EOF'\''"
    while ((getline line < svc) > 0) print line
    print "ZION_SERVICE_EOF"
    print "}"
    print "emit_nginx() { cat <<'\''ZION_NGINX_EOF'\''"
    while ((getline line < ngx) > 0) print line
    print "ZION_NGINX_EOF"
    print "}"
    print "have_config() { :; }"
    next
  }
  /^# -+ config sources END$/ { skip = 0; next }
  !skip
' "$root/deploy/install.sh" > "$stage/install.sh"

cp "$root/docs/production.md" "$stage/README-DEPLOY.md"

# A delimiter colliding with a line of config would truncate the script
# silently, and the first anyone would know is a half-written nginx site.
for d in ZION_SERVICE_EOF ZION_NGINX_EOF; do
  if grep -qx "$d" "$root/deploy/zion-api.service" "$root/deploy/nginx.conf"; then
    echo "refusing to package: '$d' appears in a config file" >&2
    exit 1
  fi
done
bash -n "$stage/install.sh" || { echo "generated install.sh is not valid shell" >&2; exit 1; }

chmod +x "$stage/install.sh" 2>/dev/null || true

# A tarball that carried a .env would hand over the database. Cheap to
# check, and the one mistake here that cannot be taken back.
if find "$stage" -name '.env' -o -name '*.key' -o -name '*.pem' | grep -q .; then
  echo "refusing to package: a secret file is staged" >&2
  exit 1
fi

# ---------------------------------------------------------- archives
say "Writing archives"
cd "$out"
rm -f zion-production.tar.gz zion-production.zip zion-dist.tar.gz zion-dist.zip
tar -czf zion-production.tar.gz zion

# Frontend only. Most uploads are this: nginx serves dist/ straight off
# disk, so a new one is live the moment it lands and needs no restart.
# The full package is for a first install, or when backend/ changed.
tar -czf zion-dist.tar.gz -C zion dist

if command -v zip >/dev/null 2>&1; then
  zip -qr zion-production.zip zion
  (cd zion && zip -qr ../zion-dist.zip dist)
elif command -v powershell.exe >/dev/null 2>&1; then
  # Git Bash on Windows has tar but no zip.
  powershell.exe -NoProfile -Command \
    "Compress-Archive -Path 'zion' -DestinationPath 'zion-production.zip' -Force" >/dev/null
  powershell.exe -NoProfile -Command \
    "Compress-Archive -Path 'zion/dist' -DestinationPath 'zion-dist.zip' -Force" >/dev/null
else
  echo "note: no zip tool found, tarballs only"
fi

# ------------------------------------------------------------ report
say "Done"
printf '%s files\n' "$(find "$stage" -type f | wc -l | tr -d ' ')"
ls -lh zion-production.* | awk '{printf "  %-26s %s\n", $9, $5}'
