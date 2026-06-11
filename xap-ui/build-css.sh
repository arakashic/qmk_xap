#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Download the pinned Tailwind v3 standalone binary for this platform if absent.
if [ ! -f bin/tailwindcss ]; then
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os-$arch" in
    Linux-x86_64)              asset="tailwindcss-linux-x64" ;;
    Linux-aarch64|Linux-arm64) asset="tailwindcss-linux-arm64" ;;
    Darwin-x86_64)             asset="tailwindcss-macos-x64" ;;
    Darwin-arm64)              asset="tailwindcss-macos-arm64" ;;
    *)
      echo "error: no known tailwindcss v3 binary for $os-$arch." >&2
      echo "Pick one from https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17" >&2
      echo "and place it at xap-ui/bin/tailwindcss (chmod +x)." >&2
      exit 1
      ;;
  esac
  mkdir -p bin
  curl -sL "https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/$asset" -o bin/tailwindcss
  chmod +x bin/tailwindcss
fi

./bin/tailwindcss -c tailwind.config.js -i styles/input.css -o assets/tailwind.css "${1:---minify}"
