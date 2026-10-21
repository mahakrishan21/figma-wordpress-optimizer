#!/bin/sh
# Run the sandbox test suites under JavaScriptCore.
#
# Each suite is concatenated after the mock and code.js, because code.js is
# a plain script with no module system — that is what the Figma sandbox
# gives it, so the tests run it the same way.
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
[ -x "$JSC" ] || { echo "JavaScriptCore not found at $JSC"; exit 1; }
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

echo "── syntax ──"
"$JSC" -e "checkSyntax('$PWD/code.js'); print('code.js OK');"

echo "── ES2017 only (no ?. ?? \\p{} outside comments) ──"
if grep -nE '\?\.|\?\?|\\p\{' code.js | grep -v '//'; then
  echo "FAIL: ES2018+ syntax found"; exit 1
fi
echo "clean"

# jsc exits 0 even when assertions fail, so the output is what decides.
status=0
for suite in tests/*tests.js; do
  echo "── $(basename "$suite") ──"
  cat tests/mockfigma.js code.js "$suite" > "$OUT/run.js"
  if ! "$JSC" "$OUT/run.js" > "$OUT/log" 2>&1; then status=1; fi
  cat "$OUT/log"
  if grep -qE '(^|  )FAIL|FAILED|THREW|Exception' "$OUT/log"; then status=1; fi
done

if [ $status -ne 0 ]; then echo; echo "SUITES FAILED"; fi
exit $status
