#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
failed=0
run() {
  local language="$1" start elapsed result
  start=$(python3 -c 'import time; print(time.monotonic())')
  shift
  if "$@"; then
    result=PASS
  else
    result=FAIL
    failed=1
  fi
  elapsed=$(python3 -c 'import sys,time; print(f"{time.monotonic()-float(sys.argv[1]):.2f}")' "$start")
  printf '%s %s wall_seconds=%s\n' "$result" "$language" "$elapsed"
}
run curl bash quickstart/curl.sh
run python uv run quickstart/python/quickstart.py
run node node quickstart/node/quickstart.mjs
exit "$failed"
