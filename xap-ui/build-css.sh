#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f bin/tailwindcss ]; then
  if [ "$(uname -s)-$(uname -m)" != "Linux-x86_64" ]; then
    echo "error: build-css.sh only knows the Linux-x86_64 tailwindcss binary;" >&2
    echo "adapt the download URL (tailwindcss-linux-x64) for $(uname -s)-$(uname -m)." >&2
    exit 1
  fi
  mkdir -p bin
  curl -sL https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-linux-x64 -o bin/tailwindcss
  chmod +x bin/tailwindcss
fi
./bin/tailwindcss -c tailwind.config.js -i styles/input.css -o assets/tailwind.css "${1:---minify}"
