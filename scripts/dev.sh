#!/usr/bin/env bash
# Dev launcher for the redesigned React UI (src-react).
#
#   ./scripts/dev.sh web       Browser UI, mock data        -> http://localhost:1430
#   ./scripts/dev.sh desktop   Tauri desktop app, real (sim) transport
#   ./scripts/dev.sh both      Browser server + Tauri off one shared React dev server
#
# Notes:
#   - The Tauri shell still targets the OLD Vue frontend; this overrides devUrl to
#     the React dev server (:1430). Plain `yarn dev` runs the old app.
#   - `desktop` / `both` need the XAP sim running to see a real device.
#   - If the Tauri window renders black (GPU/DRI3), prefix with SOFT=1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

URL="http://localhost:1430"
# Tauri config patch: point the desktop shell at the React dev server.
CONFIG_START='{"build":{"beforeDevCommand":"yarn dev:react","devUrl":"http://localhost:1430"}}'
CONFIG_ATTACH='{"build":{"beforeDevCommand":"","devUrl":"http://localhost:1430"}}'

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
    exec yarn dev:react
    ;;
  desktop)
    soft_env
    exec yarn tauri dev --config "$CONFIG_START"
    ;;
  both)
    soft_env
    if ! react_up; then
      yarn dev:react &
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
