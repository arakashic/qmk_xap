# Architecture overview

`qmk_xap` is a desktop client for the experimental [QMK XAP](https://github.com/qmk/qmk_firmware/pull/13733)
protocol. It talks to QMK-flashed keyboards over USB HID and exposes a Vue UI
for inspecting and remapping keys.

This doc is the entry point. For deeper coverage of any subsystem, see the
linked docs below.

## Stack

- **Backend** (`src-tauri/`): Rust, Tauri 2 runtime, `hidapi-rs` for USB HID,
  `binrw` for wire packet parsing.
- **Specs / domain library** (`xap-specs/`): Rust crate shared with the backend.
  Owns the keycode catalog, decoder, encoder, display engine, and lighting
  effect tables.
- **Frontend** (`src/`): Vue 3 + Quasar (UI), Pinia (state), Vite (bundler),
  TypeScript.
- **Type bridge**: [`specta`](https://docs.rs/specta) +
  [`tauri-specta`](https://docs.rs/tauri-specta) auto-generate
  `src/generated/xap.ts` from the Rust types.
- **QMK upstream** (`qmk_firmware_ref/`): a git submodule referenced for
  keycode definitions, bit-pattern constants, and documentation. Read-only as
  far as this repo is concerned.

## Package layout

```
qmk_xap/
├── src/                          # Vue 3 frontend
│   ├── pages/                    # KeymapView, DeviceInfoView, RGBView
│   ├── components/               # BasicKeyboardLayout (ANSI render)
│   ├── utils/                    # Pinia store, event bus, command wrappers
│   └── generated/xap.ts          # specta-generated TS types + command stubs
├── src-tauri/                    # Tauri / Rust binary
│   └── src/
│       ├── main.rs               # Tauri builder, event loop, command registration
│       ├── xap/
│       │   ├── client.rs         # XapClient: HID enumeration, device registry
│       │   ├── device.rs         # XapDevice: per-device state, query + remap
│       │   └── spec.rs           # XAP protocol structs (codegen output)
│       ├── aggregation/          # Normalised structs for the frontend (Config,
│       │                         # MappedKeymap, XapDeviceInfo)
│       └── rpc/
│           ├── commands.rs       # Tauri commands the frontend invokes
│           ├── events.rs         # XapEvent variants emitted to the frontend
│           └── spec.rs           # Per-subsystem command wrappers (codegen)
├── xap-specs/                    # Domain library + assets
│   ├── assets/                   # Versioned QMK keycode hjson + display config
│   │                             # + lighting effect tables (shipped resources)
│   ├── src/constants/            # Keycode catalog, decoder, encoder, display
│   ├── src/{request,response,broadcast,token}.rs  # XAP wire types
│   └── src/bin/codegen.rs        # Generator that emits src-tauri/src/{xap,rpc}/spec.rs
└── qmk_firmware_ref/             # QMK submodule (read-only)
```

## Runtime topology

```
                            ┌──────────────────┐
                            │  Vue + Quasar UI │
                            │  (Vite-served)   │
                            └────────┬─────────┘
                                     │  JSON-RPC
                  Tauri commands ────┤ (invoke / emit)
                                     │
                            ┌────────▼─────────┐
                            │  Tauri runtime   │
                            │  (Rust binary)   │
                            └────────┬─────────┘
                                     │
                  ┌──────────────────┼────────────────────┐
                  │                  │                    │
           ┌──────▼─────┐    ┌───────▼──────┐     ┌───────▼────────┐
           │ XapClient  │    │ Event loop   │     │ XapConstants   │
           │ (HID + reg)│    │ (poll loop)  │     │ (catalog + view)│
           └──────┬─────┘    └───────┬──────┘     └────────────────┘
                  │ poll + query     │ emit xap-event
           ┌──────▼─────┐            │
           │ XapDevice  │────────────┘
           │ (per HID)  │
           └──────┬─────┘
                  │ USB raw HID (XAP wire protocol)
           ┌──────▼─────┐
           │  QMK board │
           └────────────┘
```

- A background thread in `src-tauri/src/main.rs:55` (`start_event_loop`)
  enumerates HID devices once per second, polls each open device, and emits
  `XapEvent` payloads through `app.emit("xap", …)`.
- The frontend listens for `xap` events in `src/utils/events.ts:13` and
  dispatches them via a local `mitt` event bus consumed by `App.vue`.
- Frontend → backend requests use Tauri commands. Both sides are kept in sync
  by specta — see [`type-bridge.md`](type-bridge.md).

## Where to look next

- **Adding/changing keycodes, the picker, or anything keycode-shaped**:
  [`keycode-pipeline.md`](keycode-pipeline.md).
- **How Rust types reach the frontend, asset staging, dev gotchas**:
  [`type-bridge.md`](type-bridge.md).
- **Device lifecycle, secure-status flow, keymap data model, store wiring**:
  [`device-and-keymap.md`](device-and-keymap.md).

## Design ground rules

These rules are enforced informally; revisit when adding subsystems.

- **Backend owns the state of the world**. The frontend should not cache device
  data beyond the current render — re-fetch after any mutation
  (`commands.keymapGet` after `commands.remapKey`).
- **Codegen what you can**. Wire structs in `src-tauri/src/{xap,rpc}/spec.rs`
  are emitted by `xap-specs-codegen` (run via `cargo run -p xap-specs --bin
  xap-specs-codegen`). Don't edit them by hand.
- **Shared assets ship through `xap-specs/assets/`**. They're declared as Tauri
  resources in `src-tauri/tauri.conf.json` and resolved at runtime via
  `BaseDirectory::Resource`. Changes to these files in dev mode need
  `touch src-tauri/tauri.conf.json` to resync — see
  [`type-bridge.md`](type-bridge.md#asset-staging-in-dev).
- **One source of truth for bit-pattern constants**. The QMK header
  (`qmk_firmware_ref/quantum/keycodes.h`, `modifiers.h`) is canonical;
  `xap-specs/src/constants/keycode_encoder.rs` mirrors it and has a header-drift
  test (see [`keycode-pipeline.md`](keycode-pipeline.md#verifying-against-qmk)).
