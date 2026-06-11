# QMK XAP Client

This repository contains the (experimental) [QMK XAP](https://github.com/qmk/qmk_firmware/pull/13733) protocol client.

It is **one [Dioxus](https://dioxuslabs.com/) app over a shared Rust core**, compiled to two renderers:

- a **desktop app** (Dioxus Desktop / [wry](https://github.com/tauri-apps/wry) + [hidapi](https://github.com/ruabmbua/hidapi-rs), in-process — no IPC), and
- a **browser web app** (the same crate compiled to WebAssembly, talking to keyboards over [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API)).

The UI, pages, stores and protocol logic are shared; only the transport backend differs, selected at compile time by target.

Base technologies:

- [Rust](https://www.rust-lang.org/) — everything: the shared XAP core, the UI, and both transport backends
- [Dioxus 0.7](https://dioxuslabs.com/) + [dioxus-router](https://dioxuslabs.com/learn/0.7/router/) — the shared frontend (RSX components, signals)
- [Tailwind v3](https://tailwindcss.com/) (+ vendored Roboto / Material Icons) — styling, recreating the prior Quasar look
- [hidapi](https://github.com/ruabmbua/hidapi-rs) — the native desktop transport
- WebHID (via `web-sys`, unstable-gated) — the browser transport

## Architecture / Design

The guiding principle is that **all authoritative XAP logic lives once, in Rust, with no knowledge of how reports get on or off the wire**. The UI talks to an `XapBackend` trait; each target supplies one implementation. The two backends return identical Rust values, so the same pages drive the desktop and the browser unchanged.

<details>
<summary>Diagram source (mermaid)</summary>

```
flowchart TD
    ui["<b>Shared UI</b><br/>Dioxus components / pages / stores<br/>(talks only to the XapBackend trait)"]

    subgraph Native["Native backend (desktop, cfg = not wasm)"]
        actor["actor thread owning XapClient + HidApi"]
        worker["per-device HID I/O worker thread"]
        actor <--> worker
    end

    subgraph Web["Web backend (browser, cfg = wasm)"]
        webexec["WebExecutor (Rc&lt;RefCell&gt;, one in-flight query/device)"]
        webhid["WebHID (navigator.hid)"]
        webexec <--> webhid
    end

    core["<b>xap-core</b><br/>shared, transport-independent<br/>XAP state machine + session orchestration"]

    dev["XAP device(s)"]

    ui <-->|"async trait calls"| actor
    ui <-->|"async trait calls"| webexec

    worker <--> core
    webhid <--> core

    worker <-->|"USB raw HID"| dev
    webhid <-->|"WebHID"| dev
```

</details>

Both backends build on the same central `xap-core` and drive its `submit` / `ingest` / `take_response` boundary directly; they differ only in transport — `hidapi` on a worker thread on the desktop, WebHID in the browser.

### The shared core (`xap-core`)

`xap-core` is a synchronous, **non-blocking, push-driven** state machine. It owns the XAP protocol but never performs I/O, spawns threads, reads the clock, or links against `hidapi` or the DOM. That is what makes it usable from a blocking desktop thread and a single-threaded browser alike, and what lets it compile to `wasm32-unknown-unknown`.

The transport boundary is three operations:

- `submit(writer, request) -> Token` — frame a request and hand the bytes to the adapter's writer; record the in-flight token. It does **not** wait.
- `ingest(report) -> IngestOutcome` — feed one inbound report in; correlate it to the pending request or decode a broadcast (applying secure-status side effects).
- `take_response::<T>(token) -> Option<T::Response>` — decode the matched response.

Adapters own all waiting and all I/O. Two small traits express the seam (`xap-core/src/transport.rs`):

- `XapWriter` — the core calls this to put report bytes on the wire.
- `XapQueryExecutor` — an async `query::<T>()` the *backend* implements (submit + wait + decode). The multi-step protocol orchestration in `xap-core/src/session.rs` (device-info aggregation, gzip config-blob fetch/parse, keymap and encoder sweeps, remapping, secure status) is generic over this executor, so the request sequence and capability gating live in exactly one place. The desktop drives it by blocking on a worker channel (resolving on first poll); the browser, which cannot block, drives the same sequence asynchronously over WebHID.

`xap-core/src/client.rs` keeps a registry of devices by [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier) and routes inbound reports and broadcast events. Aggregated, frontend-facing types (`XapDeviceInfo`, `Config`, the keymap, etc.) live under `xap-core/src/aggregation/`.

### The `XapBackend` trait (`xap-ui/src/backend`)

The UI references one trait — `XapBackend` (`backend/mod.rs`) — and `select_backend()` returns the right implementation for the target. The trait carries the aggregation operations (`device_get`, `keymap_get`, `encoder_keymap_get`, `remap_key`, …) plus the specific one-shot routes the pages need (secure lock/unlock, bootloader/EEPROM, rgblight get/set/save, encoder keycode get/set). Device add/remove and broadcasts flow back through an event handler the app registers via `set_event_listener`.

**Native (`backend/native`, desktop):** a `hidapi` `HidDevice` is neither `Clone` nor `Sync`, so a dedicated **actor thread** owns the `XapClient` (and `HidApi`). The UI sends boxed jobs over a channel; replies travel back through oneshot channels. Each device additionally gets a **HID I/O worker thread** (the sole reader *and* writer) that drains a write queue, non-blocking-reads reports, and feeds each into `core.ingest(...)`. Device events and broadcasts flow worker → an event channel → an in-runtime pump task in `app.rs` (so signal writes stay inside the Dioxus runtime). The core lock is held only across `submit`/`ingest`/`take_response`, never across the wait or HID I/O.

**Web (`backend/web`, browser):** single-threaded WASM, so `Rc<RefCell<WebState>>`. It opens a device through `navigator.hid` (behind a user-gesture "Connect" button), wires each `inputreport` event into the ingest routine, and exposes the device's `sendReport` as the core's writer. A `WebExecutor` implements `XapQueryExecutor` with one in-flight query per device. The strict borrow rule: never hold a `RefCell` borrow across an `.await` or a re-entrant call (the one sync JS call under a borrow is `sendReport`, which returns a Promise and cannot re-enter).

### Generated code

Protocol route types are generated from the HJSON specs in `xap-specs/assets` into `xap-specs/src/spec.rs` (shared by all crates) by `xap-specs/src/bin/codegen.rs`. That is now the *only* generated artifact — there is no generated per-route command surface; both backends call `xap-core::session` and the typed request structs directly. Serialization is [Serde](https://serde.rs/) (the browser path uses `serde_json` so its shapes match the desktop), and raw XAP HID packets are parsed with [binrw](https://binrw.rs/).

## Project Structure

```
.
├── xap-ui/                     # the Dioxus app (desktop + web)
│  └── src/
│     ├── main.rs               #   launcher (dioxus::launch)
│     ├── app.rs                #   root: contexts, XapEvent handler, native pump, router
│     ├── backend/              #   XapBackend trait + impls
│     │  ├── native/            #     actor thread + XapClient + HID worker (desktop)
│     │  └── web/               #     WebHID transport + WebExecutor (browser)
│     ├── pages/                #   XAP subsystems as pages (keymap, encoder, rgb, …)
│     ├── components/           #   layout shell, primitives, key widgets, color picker
│     ├── store/                #   device / broadcast / ui stores (signals over pure data)
│     └── util/                 #   formatting, keycode families, time, broadcast helpers
├── xap-core/                   # shared, transport-independent XAP core (Rust)
│  └── src/
│     ├── device.rs             #   submit / ingest / take_response state machine
│     ├── client.rs             #   device registry + broadcast routing
│     ├── session.rs            #   protocol orchestration (executor-generic)
│     ├── transport.rs          #   XapWriter / XapQueryExecutor / IngestOutcome
│     ├── events.rs             #   XapEvent
│     └── aggregation/          #   aggregated device-info / config / keymap types
└── xap-specs/                  # XAP protocol types (generated) + constants + assets
```

## Running

Prerequisites: a Rust toolchain with the `wasm32-unknown-unknown` target and the [Dioxus CLI](https://dioxuslabs.com/learn/0.7/getting_started/) (`dx`). The desktop app additionally needs, **on Linux only**, the wry/GTK system libraries (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libxdo-dev`, `libsoup-3.0-dev`, `libudev-dev`); on macOS and Windows the system WebView (WebKit / WebView2) is built in, so no extra packages are required. `build-css.sh` auto-downloads the matching Tailwind binary for Linux/macOS (x64 or arm64).

Tailwind is built separately (it is not run by `dx`); the script downloads the pinned standalone v3 binary on first run:

```bash
./xap-ui/build-css.sh          # writes xap-ui/assets/tailwind.css (git-ignored)
```

Re-run it after any change that adds new Tailwind classes.

### Desktop app

```bash
cd xap-ui && dx serve --platform desktop
```

Devices are enumerated automatically; the keyboard appears within ~1s.

### Browser web app

```bash
cd xap-ui && dx serve --platform web
```

Open it in a **Chromium-based browser** (Chrome/Edge — WebHID only) over `localhost` or HTTPS, then click **Connect** and pick your keyboard. Unlike the desktop app, the browser requires this one-time user gesture to grant device access.

### Design "Rules"

**General:**

- Robust error handling; a failed request must not leave the client wedged.
- Leverage types and APIs that are hard to misuse; keep the protocol logic in one place.
- All inter-component communication provides log/tracing messages for easy introspection.

**The frontend:**

- Is as dumb as possible — it presents data and prepares data to send, through the `XapBackend` trait only.
- Holds as little state as possible and re-fetches from the backend.
- Reacts to asynchronous events and syncs its stores: device added / removed, secure-status changed, broadcasts.

**The Rust core:**

- Owns and abstracts the XAP protocol; performs no I/O, threading, or clock access.
- Aggregates raw device data into normalized structs the frontend consumes (e.g. on connect, all static device info + config blob + keymap are fetched once).

**The backends:**

- Own all transport: USB raw HID on desktop (one worker thread per device), WebHID in the browser.
- Drive the core's `submit` / `ingest` / `take_response` boundary; never reimplement protocol logic.

### Outlook

- Sharing the desktop window auto-resize ergonomics to the web build.
- Supporting keyboard and user XAP routes.
- Various optimizations.
