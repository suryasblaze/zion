#!/usr/bin/env bash
#
# Start the API in the background.
#
#   ./start.sh
#
# Here because the real command is long enough to get mistyped, and the
# part that gets lost is the trailing "&" -- without it the server stops
# the moment the terminal closes, which looks exactly like a server that
# refused to start.
#
# Prefer the systemd unit if it is installed (systemctl restart zion-api):
# that restarts on crash and survives a reboot, and this does neither.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

PORT="${PORT:-5004}"
WORKERS="${WORKERS:-3}"
LOG="${LOG:-/var/log/zion-error.log}"

if [ ! -x ../venv/bin/gunicorn ]; then
  echo "No venv at ../venv -- create it first:"
  echo "  python3 -m venv ../venv && ../venv/bin/pip install -r requirements.txt"
  exit 1
fi

# Replace whatever is already there, so this is safe to run twice.
pkill -f "gunicorn app:app" 2>/dev/null || true
sleep 1

nohup ../venv/bin/gunicorn app:app \
  --bind "127.0.0.1:$PORT" \
  --workers "$WORKERS" \
  --threads 4 \
  --worker-class gthread \
  --timeout 60 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --error-logfile "$LOG" \
  >/dev/null 2>&1 &

# Say whether it actually came up, rather than leaving you to find out
# from the website.
for _ in $(seq 1 15); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "running on 127.0.0.1:$PORT"
    curl -s "http://127.0.0.1:$PORT/api/health"
    echo
    exit 0
  fi
  sleep 1
done

echo "did not come up. Last lines of $LOG:"
tail -20 "$LOG" 2>/dev/null || echo "  (no log yet)"
exit 1
