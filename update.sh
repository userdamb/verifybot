#!/usr/bin/env bash
set -e
# VerifyBot updater. Usage: bash update.sh [git-ref|commit-sha]
# Pull a fresh code release from jsDelivr and restart, WITHOUT touching .env.
REF="${1:-main}"
REPO="userdamb/verifybot"
APP_DIR=/opt/verifybot

echo "[update] fetching release @ ${REF} ..."
curl -fsSL "https://cdn.jsdelivr.net/gh/${REPO}@${REF}/release.tgz" -o /tmp/vb_release.tgz

mkdir -p "$APP_DIR"
echo "[update] extracting code (current .env is preserved) ..."
tar xzf /tmp/vb_release.tgz -C "$APP_DIR"
rm -f /tmp/vb_release.tgz

cd "$APP_DIR"
echo "[update] npm install ..."
npm install --omit=dev

echo "[update] restart under pm2 ..."
pm2 restart verifybot --update-env || pm2 start index.js --name verifybot
pm2 save >/dev/null 2>&1 || true
echo "=== UPDATE DONE (${REF}) ==="
