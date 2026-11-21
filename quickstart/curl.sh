#!/usr/bin/env bash
set -euo pipefail

base="${NIM_BASE_URL:-https://integrate.api.nvidia.com/v1}"
base="${base%/}"
key="${NVIDIA_API_KEY:-}"
if [[ "$(python3 -c 'import sys,urllib.parse; print(urllib.parse.urlparse(sys.argv[1]).hostname)' "$base")" == integrate.api.nvidia.com && -z "$key" ]]; then
  echo 'Set NVIDIA_API_KEY first. Get a free key at https://build.nvidia.com.' >&2
  exit 1
fi
# Use an array so an unauthenticated local server needs no Authorization header.
auth=()
[[ -z "$key" ]] || auth=(-H "Authorization: Bearer $key")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

check_status() {
  python3 -c '
import json,sys
status = int(sys.argv[1])
if 200 <= status < 300: sys.exit(0)
try:
    with open(sys.argv[2]) as f: body = json.load(f)
except (ValueError, OSError): body = {}
if status == 410:
    message = "410: " + str(body.get("detail", "Model reached end of life.")) + " Pick another model from /v1/models."
else:
    message = {401: "401: Check NVIDIA_API_KEY or your server credentials.", 429: "429: Rate limit reached. Wait before trying again.", 404: "404: Model not found. Pick a chat model from /v1/models."}.get(status, f"HTTP {status}: Request failed. Check the server and model.")
sys.exit(message)
' "$1" "$2"
}

# Step 1: list the live catalog.
echo '1. List models'
printf 'curl -sS --max-time %q %q' "${NIM_TIMEOUT_SECONDS:-120}" "$base/models"
[[ -z "$key" ]] || printf ' -H "Authorization: Bearer $NVIDIA_API_KEY"'
printf '\n'
status=$(curl -sS --max-time "${NIM_TIMEOUT_SECONDS:-120}" "${auth[@]}" "$base/models" -o "$work/models.json" -w '%{http_code}') || { echo 'Request failed. Check NIM_BASE_URL and connectivity.' >&2; exit 1; }
check_status "$status" "$work/models.json"

# Step 2: intersect chat preferences with the catalog, or honor NIM_MODEL.
echo '2. Pick a chat model'
model=$(python3 -c '
import json,os,sys
try:
    with open(sys.argv[1]) as f: ids = [m["id"] for m in json.load(f)["data"]]
except (ValueError, KeyError, TypeError): sys.exit("Invalid model catalog. Check NIM_BASE_URL.")
print("Catalog: " + ", ".join(ids[:8]), file=sys.stderr)
preferred = ["nvidia/nemotron-3.5-bolt-e4b", "nvidia/nemotron-3.5-lightning-30b-a3b", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"]
model = os.getenv("NIM_MODEL") or next((m for m in preferred if m in ids), None)
if not model: sys.exit("Set NIM_MODEL to a chat model from /v1/models.")
print(model)
' "$work/models.json")
printf 'Selected: %s\n' "$model"
payload=$(python3 -c 'import json,sys; print(json.dumps({"model":sys.argv[1],"messages":[{"role":"user","content":"Say hello in one short sentence."}],"max_tokens":512,"stream":False}))' "$model")

# Step 3: ordinary JSON is easiest to inspect. Python and Node demonstrate streaming.
echo '3. Chat (non-streamed)'
printf 'curl -sS --max-time %q %q' "${NIM_TIMEOUT_SECONDS:-120}" "$base/chat/completions"
[[ -z "$key" ]] || printf ' -H "Authorization: Bearer $NVIDIA_API_KEY"'
printf ' -H '\''Content-Type: application/json'\'' -d %s\n' "$(python3 -c 'import shlex,sys; print(shlex.quote(sys.argv[1]))' "$payload")"
start=$(python3 -c 'import time; print(time.monotonic())')
status=$(curl -sS --max-time "${NIM_TIMEOUT_SECONDS:-120}" "${auth[@]}" "$base/chat/completions" -H 'Content-Type: application/json' -d "$payload" -o "$work/chat.json" -w '%{http_code}') || { echo 'Request failed. Check NIM_BASE_URL and connectivity.' >&2; exit 1; }
check_status "$status" "$work/chat.json"
python3 -c '
import json,sys,time
try:
    with open(sys.argv[1]) as f: message = json.load(f)["choices"][0]["message"]
    text = message.get("content") or message.get("reasoning_content")
    if not text: sys.exit("No text returned. Try another chat model or raise max_tokens for reasoning models.")
    print(text)
    print(f"model={sys.argv[2]} ttft_ms=n/a (non-streamed) total_ms={(time.monotonic()-float(sys.argv[3]))*1000:.0f}")
except (ValueError, KeyError, IndexError, TypeError): sys.exit("Invalid chat response. Check the server and model.")
' "$work/chat.json" "$model" "$start"
