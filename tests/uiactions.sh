#!/bin/sh
# Drive every action on the Build design system tab in a real browser.
# Uses the Chromium that Playwright already cached — nothing to install.
set -e
cd "$(dirname "$0")/.."
SHELL_BIN="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell"
[ -x "$SHELL_BIN" ] || { echo "No headless Chromium at $SHELL_BIN"; exit 1; }

PORT=${PORT:-8961}
STARTED=""
if ! curl -s -o /dev/null "http://localhost:$PORT/ui.html"; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  STARTED=$!
  sleep 1
fi
trap '[ -n "$STARTED" ] && kill $STARTED 2>/dev/null' EXIT

OUT=$("$SHELL_BIN" --headless --disable-gpu --no-sandbox --virtual-time-budget=20000 \
  --dump-dom "http://localhost:$PORT/tests/uiactions.html" 2>/dev/null \
  | sed -n '/<pre id="results">/,/<\/pre>/p' \
  | sed 's/<pre id="results">//; s/<\/pre>//' \
  | sed 's/&quot;/"/g; s/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&#39;/'"'"'/g')

echo "$OUT"
echo "$OUT" | grep -q '^VERDICT: PASS' || exit 1
