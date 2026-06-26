#!/usr/bin/env bash
# Dev launcher for the React UI.
#
#   ./scripts/dev.sh web       Browser UI (WebHID)          -> http://localhost:1430
#   ./scripts/dev.sh desktop   Tauri desktop app, real (sim) transport
#   ./scripts/dev.sh both      Browser server + Tauri off one shared dev server
#
# Notes:
#   - `tauri.conf.json` targets the React dev server (:1430); `yarn dev` and
#     `desktop` start it automatically. For browser mock data use `yarn vite:dev:mock`.
#   - `desktop` / `both` need the XAP sim running to see a real device.
#   - If the Tauri window renders black (GPU/DRI3), prefix with SOFT=1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

URL="http://localhost:1430"
# When attaching Tauri to an already-running vite, clear beforeDevCommand so it
# does not spawn a second dev server (devUrl already points at :1430).
CONFIG_ATTACH='{"build":{"beforeDevCommand":""}}'

soft_env() {
  if [[ "${SOFT:-}" == "1" ]]; then
    export WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1
  fi
}
react_up() { curl -sf "$URL" >/dev/null 2>&1; }

usage() {
  # print the leading comment block (skip shebang, stop at first non-comment line)
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
}

case "${1:-}" in
  web)
    exec yarn vite:dev
    ;;
  desktop)
    soft_env
    exec yarn tauri dev
    ;;
  both)
    soft_env
    if ! react_up; then
      yarn vite:dev &
      VITE_PID=$!
      trap 'kill "$VITE_PID" 2>/dev/null || true' EXIT
      until react_up; do sleep 0.3; done
    fi
    # vite already running -> attach Tauri to it (no second dev server)
    yarn tauri dev --config "$CONFIG_ATTACH"
    ;;
  *)
    usage
    exit 1
    ;;
esac
