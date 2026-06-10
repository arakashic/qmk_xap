# dx 0.7.9 API facts (pinned during Task 1.1 scaffold)

Verified on 2026-06-10, Linux (Wayland session, X11 via GDK_BACKEND).

## Versions

- `dx --version` -> `dioxus 0.7.9 (bfcc111)`
- rustc 1.96.0
- dx auto-installs `wasm-bindgen-cli@0.2.123` on first web build.

## Launch call that works

```rust
dioxus::launch(app);   // app: fn app() -> Element
```

No `cfg`-gated launcher needed; `dioxus::launch` picks the renderer from the
enabled feature (`dioxus/desktop` vs `dioxus/web`).

## Dioxus.toml schema that works

```toml
[application]
name = "xap-ui"

[web.app]
title = "QMK XAP Client"
```

dx 0.7.9 accepts this as-is; the served HTML `<title>` is "QMK XAP Client"
(verified via curl of the dev server).

## How `dx serve --platform X` interacts with `[features]`

Crate has:

```toml
[features]
default = ["desktop"]
desktop = ["dioxus/desktop"]
web = ["dioxus/web"]
```

`dx build/serve --platform web --verbose` logs:

```
DEBUG Dropping feature dioxus/desktop since it points to a platform renderer transitively
DEBUG Found feature web for renderer web
• features: ["web"]
```

So dx scans the crate's `[features]` block, recognizes features that
(transitively) enable a dioxus renderer, drops the default renderer feature
(`desktop`) and enables the one matching `--platform`. It literally passes
`--no-default-features --features <platform>` - the actual cargo process dx
spawned for the desktop build (caught via pgrep) was:

```
cargo rustc --message-format json-diagnostic-rendered-ansi \
  --config profile.desktop-dev.strip=false \
  --config 'profile.desktop-dev.inherits="dev"' \
  --profile desktop-dev --target x86_64-unknown-linux-gnu --verbose \
  --no-default-features --features desktop -p xap-ui --bin xap-ui \
  -- -Clink-arg=-Wl,-rpath,$ORIGIN/../lib -Clink-arg=-Wl,-rpath,$ORIGIN
```

Note: dx uses its own `desktop-dev` / (web) profiles and an explicit
`--target x86_64-unknown-linux-gnu`, so dx builds do not share the cache with
plain host-target `cargo check`. No manual feature flags are needed on the dx
command line.

## cargo check invocations (both pass)

```bash
# host / desktop
cargo check -p xap-ui

# wasm / web
cargo check -p xap-ui --target wasm32-unknown-unknown --no-default-features --features web
```

The wasm one relies on repo-root `.cargo/config.toml`:

```toml
[target.wasm32-unknown-unknown]
rustflags = ["--cfg=web_sys_unstable_apis"]
```

(required for web-sys WebHID bindings, which are unstable APIs).

## Workspace lock conflict: src-tauri no longer compiles (known, accepted)

Adding xap-ui (dioxus 0.7) to the workspace re-resolved Cargo.lock and broke
the old pinned `tauri 2.0.0-beta.16` stack: `tauri-utils` 2.0.0-beta.16 ->
2.9.2, `tauri-runtime`(-wry) beta.17 -> 2.11.2/2.9.3, which the beta
tauri-build/tauri-plugin sources cannot compile against
(`cargo check -p qmk-xap-gui` now fails with E0061/E0308/E0425 inside
registry sources).

Downgrading back is IMPOSSIBLE while both crates are in one lock: the root
conflict is `kuchikiki` - wry 0.40 (old tauri) wants `^0.8` (= 0.8.2), wry
0.53.5 (dioxus-desktop 0.7.9) wants `= 0.8.8-speedreader`; same semver-major,
so cargo must pick one. Verified 2026-06-10 via
`cargo update -p tauri-runtime-wry --precise 2.0.0-beta.17` -> resolver error.

Accepted because the migration plan never builds src-tauri again: it is
reference source only (ports read the files), baselines are captured from the
deployed public web app, and Phase 7 deletes src-tauri. If src-tauri must
build again before then, move xap-ui out of the workspace (own lockfile).

## Serve + screenshot recipes

### Web

```bash
cd xap-ui && dx serve --platform web --port 1430 &
# Server answers HTTP 200 almost immediately (loading shell); the real signal
# is the log line "Build completed successfully in XXs, launching app!"
# (first cold wasm build: ~60s).
google-chrome --headless=new --disable-gpu --window-size=800,400 \
  --virtual-time-budget=15000 \
  --screenshot=/tmp/dx-hello-web.png http://localhost:1430/
```

Gotcha: without `--virtual-time-budget`, headless Chrome screenshots before
the wasm executes and you get a blank page. 15000ms budget renders reliably.

### Desktop

```bash
cd xap-ui && GDK_BACKEND=x11 dx serve --platform desktop &
# wait for "Build completed successfully ... launching app!" in the log
# (first cold desktop build: ~100s; emits benign libEGL DRI3 warnings)

# find the X window id (window is on XWayland thanks to GDK_BACKEND=x11)
xwininfo -root -tree | grep 'xap-ui'   # e.g. 0xa00003, 800x600

# THE ONLY WORKING PIXEL CAPTURE on this GNOME Wayland box:
gst-launch-1.0 ximagesrc xid=0xa00003 num-buffers=1 \
  ! videoconvert ! pngenc ! filesink location=/tmp/dx-hello-desktop.png
```

Capture dead ends on this box (all tried 2026-06-10, do not retry):
- `scrot` (full root or `-w <wid>`) -> black image; the Wayland compositor
  does not expose XWayland window pixels to XGetImage the way scrot uses it.
- `org.gnome.Shell.Screenshot` D-Bus -> AccessDenied.
- xdg-desktop-portal `Screenshot` -> hangs waiting for interactive consent.
- No xwd / import / convert / xdotool / wmctrl / Xvfb / grim installed;
  no sudo to install.
- `gst-launch-1.0 ximagesrc xid=<wid>` DOES return real pixels. The verified
  run also had `WEBKIT_DISABLE_COMPOSITING_MODE=1` set on the app (untested
  without it).

Other desktop facts:
- `GDK_BACKEND=x11` is needed on this Wayland session so the wry/GTK window
  is an XWayland window that X tools can find/capture.
- Under `dx serve` the window title is "QMK XAP Client"; running the built
  binary directly (`target/dx/xap-ui/debug/linux/app/xap-ui-<hash>`) titles
  it "Dioxus App" (default). The built binary runs fine standalone, no dx
  needed.
