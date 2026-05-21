# Devices and the keymap model

How a USB HID keyboard becomes a `XapDeviceState` the Vue app can render,
how state changes flow back out to the frontend, and what the keymap data
structures look like.

## Lifecycle

### Discovery

`src-tauri/src/main.rs:55` (`App::start_event_loop`) runs a background
thread that:

- Calls `XapClient::enumerate_xap_devices` once per second.
- Calls `XapClient::poll_devices` every 100 ms.

Enumeration filters HID devices by the XAP usage page/usage pair
(`XAP_USAGE_PAGE = 0xFF51`, `XAP_USAGE = 0x0058` in
`src-tauri/src/xap/client.rs:18`), opens any newly-attached device, drops
any that disappeared, and emits `XapEvent::NewDevice` /
`XapEvent::RemovedDevice` payloads.

### Per-device initialisation

`XapDevice::new` (`src-tauri/src/xap/device.rs:138`) immediately fires three
queries against the freshly-opened HID handle:

1. `query_device_info` — `XapVersion`, `QmkCapabilities`, board identifiers,
   product/manufacturer strings, hardware ID, plus a per-subsystem capability
   probe (keymap, remap, lighting). The result lives in
   `XapDeviceState.info: Option<XapDeviceInfo>`. Aggregated structs are in
   `src-tauri/src/aggregation/mod.rs`.
2. `query_keymap` — pulls every layer/row/column position and caches the
   decoded `KeyCode` into `Keymap`.
3. `query_secure_status` — probes whether the device is `Unlocked`,
   `Locked`, or `Unlocking`.

A device is therefore "ready" the moment `XapEvent::NewDevice` fires; the
frontend can immediately `commands.deviceGet(id)` to receive a fully
populated `XapDeviceState`.

### Polling and broadcasts

`XapClient::poll_devices` (`src-tauri/src/xap/client.rs:44`) drains each
device's broadcast queue and translates entries into `XapEvent`s:

| Broadcast type           | Action                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `Log`                    | emits `XapEvent::LogReceived { id, log }`                                                             |
| `SecureStatus`           | mutates `XapDevice.state.secure_status`, emits `XapEvent::SecureStatusChanged { id, secure_status }`  |
| `Keyboard`, `User`       | logged as `error!`; not implemented yet                                                               |

`XapDevice::poll` (the per-device function) reads from the HID handle in
non-blocking mode and routes incoming reports to either the response map
(for outstanding `query` calls) or the broadcast queue.

## Wire flow for `SecureStatusChanged`

End-to-end so the AI/human reader has a concrete event-flow example. The
secure status is the only piece of device state that can change
asynchronously from the device's side, so it's the cleanest test case.

```
1. User triggers unlock on the keyboard (key combo, dedicated unlock flow)
2. Firmware emits a SecureStatus broadcast over HID
3. XapDevice::poll reads the report, pushes onto broadcast_queue
4. XapClient::poll_devices drains the queue, updates
   XapDevice.state.secure_status, and returns
   XapEvent::SecureStatusChanged
5. App::emit_event sends app.emit("xap", event)
6. src/utils/events.ts forwards the payload to eventBus
7. src/App.vue's eventBus.on('xap', ...) switch case calls
   store.updateSecureStatus(id, secure_status)
8. The Pinia mutation triggers reactive re-renders (e.g.
   KeymapView.vue's pending writes gating on device.secure_status)
```

## State shape: `XapDeviceState`

```rust
// src-tauri/src/xap/device.rs:115
pub struct XapDeviceState {
    pub id: Uuid,
    pub info: Option<XapDeviceInfo>,
    #[serde(skip)] pub keymap: Keymap,    // raw matrix; not crossed to TS
    pub config: Config,                   // layouts + matrix size
    pub secure_status: XapSecureStatus,
}
```

Notes:

- `keymap` is marked `#[serde(skip)]` because the raw matrix isn't useful
  to the frontend on its own. The frontend instead calls
  `commands.keymapGet(id, layout)` which returns a `MappedKeymap`
  (matrix ⨯ layout). See [Keymap data](#keymap-data).
- `info` is `None` until the device handshake finishes, then `Some(...)`.
  The frontend null-checks before reading nested fields.
- `XapDeviceInfo` (`aggregation/mod.rs:48`) groups static device facts and
  per-subsystem capabilities (`KeymapInfo`, `RemapInfo`, `LightingInfo`).
  `RemapInfo.set_keycode_enabled` is what gates the picker — if the device
  doesn't support remap, the picker simply can't write.

## Frontend mirror: Pinia store

`src/utils/deviceStore.ts` is intentionally thin:

```ts
state: {
    device:  XapDeviceState | null,      // currently-selected device
    devices: Map<string, XapDeviceState> // all attached
}
actions: {
    addDevice(device)              // adds + auto-selects if none selected
    removeDevice(id)               // drops + falls back to next device
    updateSecureStatus(id, status) // mutates in place
}
```

That's the entire store. There is no caching of keymap data here — the
keymap is re-fetched via `commands.keymapGet` after every remap so the
frontend never serves stale rows.

Event handling in `src/App.vue:30` listens to the `xap` topic on the local
mitt `eventBus` (`src/utils/eventbus.ts`) and dispatches:

| `event.kind`            | Effect                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `NewDevice`             | Calls `commands.deviceGet(id)` for the full state, then `store.addDevice(...)`.        |
| `RemovedDevice`         | `store.removeDevice(id)`, with a "Removed Device <product>" toast.                     |
| `SecureStatusChanged`   | `store.updateSecureStatus(id, secure_status)`.                                         |
| `LogReceived`           | Currently unhandled in `App.vue` — Tauri side emits it, frontend can opt in.           |

## Keymap data

There are two related Rust types and one wire type. Knowing which is which
prevents confusion.

### `Keymap` (backend-internal)

`src-tauri/src/xap/device.rs:69` — a 3D `Vec<Vec<Vec<KeymapKey>>>` indexed
`[layer][row][column]`. Lives on `XapDeviceState.keymap` but never crosses
to the frontend (`#[serde(skip)]`). Filled in by `query_keymap` and mutated
incrementally by `remap_key` so the device's view of its own keymap stays
in sync.

```rust
pub struct KeymapKey {
    pub code: KeyCode,
    pub position: Point3D,
}
```

`Point3D` indexes `(x: column, y: row, z: layer)`. Note the field-name vs.
axis-name distinction — `Point3D.x` is the column.

### `MappedKeymap` (wire type)

`src-tauri/src/aggregation/keymap.rs:16` — the version the frontend sees.
Adds a `LayoutEntry` per key (geometry / wheel mapping) and may have `None`
slots where the matrix has no physical key in the selected layout.

```rust
pub struct MappedKeymapKey {
    pub key:    KeymapKey,
    pub layout: LayoutEntry,
}
pub struct MappedKeymap {
    pub keys:       Vec<Vec<Vec<Option<MappedKeymapKey>>>>,
    pub dimensions: Point3D,
    pub size:       Point2D,   // observed max x/y; used to size the panel
}
```

Built by `XapDevice::keymap_with_layout(layout)` (`device.rs:194`) which
iterates the raw `Keymap` and looks up each `(row, column)` in the named
layout. Keys that exist in the matrix but aren't part of the selected layout
get dropped.

### `KeyCode` (catalog or decoded)

The same struct serves two sources:

- **Catalog**: loaded from `xap-specs/assets/keycodes_X.Y.Z.generated.hjson`,
  with label/description overrides applied from `keycode_display.hjson`.
  `template` is `None`.
- **Decoded**: synthesised by `decode_parameterized` for parameterized values
  not in the catalog (MT, LT, LM, QK_MODS, layer ops). `template` is `Some`,
  `top`/`bottom` are set for keys with a split visual.

Resolution happens in `XapKeyCodeCatalog::get_keycode`
(`xap-specs/src/constants/keycode.rs:108`):

```
lookup table hit  → return cached catalog entry (with overrides)
        miss     → decode_parameterized
                     hit  → return synthesised KeyCode (with template)
                     miss → KeyCode::new_custom (hex label, group "USER-CUSTOM")
```

For everything else about how this interacts with the picker, see
[`keycode-pipeline.md`](keycode-pipeline.md).

## Remap path

`KeymapView.vue` → `commands.remapKey(id, { layer, row, column, keycode })`
→ Tauri command `remap_key` (`src-tauri/src/rpc/commands.rs:22`) →
`XapDevice::remap_key` (`device.rs:229`):

1. Sends `RemappingSetKeycodeRequest` over HID.
2. Immediately re-reads the keycode via `query_key` to confirm what the
   firmware now reports.
3. Updates `Keymap` in place.
4. Returns `()` to the frontend.
5. Frontend then calls `commands.keymapGet` to refresh the rendered
   `MappedKeymap`.

The "read-back after write" is intentional: it confirms the firmware
accepted the write and surfaces any rejections (e.g., trying to write while
locked).

## Common changes

### Add a new XAP query

1. Find the relevant request struct in `src-tauri/src/xap/spec.rs`
   (generated from `xap-specs/assets/xap_*.hjson`).
2. Call `self.query(YourRequest(args))?` from `XapDevice` and store the
   result on `XapDeviceState` (or aggregate into an `XapDeviceInfo` field).
3. If the result should cross to TS, derive `Type` on the storage struct.
4. Restart `yarn tauri dev` to regenerate `xap.ts`.

### Handle a new broadcast type

1. In `xap-specs/src/broadcast.rs`, the `BroadcastType` enum already covers
   `Log`, `SecureStatus`, `Keyboard`, `User`. Pick or add the relevant one.
2. Extend `XapClient::poll_devices`
   (`src-tauri/src/xap/client.rs:50-67`) to translate that broadcast into a
   new `XapEvent` variant.
3. Add the variant to `XapEvent` in `src-tauri/src/rpc/events.rs`.
4. Handle it in `src/App.vue`'s switch.

### Add new state surfaced to the frontend

If the new state changes asynchronously (like secure status), use the
event pattern above. If it's pull-only, add a Tauri command in
`src-tauri/src/rpc/commands.rs` and register it in `main.rs`'s
`generate_specta_builder!`. See
[`type-bridge.md`](type-bridge.md#add-a-new-tauri-command).

### Surface a new XAP capability flag

Probe it during `XapDevice::query_device_info` and store on one of the
`*Info` structs in `aggregation/mod.rs`. The frontend reads via
`device.info.keymap.<flag>` or similar.

## Verification

- Plug in a QMK XAP-capable keyboard, `yarn tauri dev`, watch the Rust log
  for `started event loop`, the enumeration tick, and the device init
  queries.
- The frontend should print `new device with id <uuid>` in the browser
  console once `addDevice` fires.
- Toggle secure status from the keyboard and confirm the `SecureStatusChanged`
  event arrives in the log + the Pinia mutation flips
  `device.value.secure_status`.

## Known limits

- **`Keyboard` and `User` broadcasts are silently dropped** (logged as
  `error!`). Implementing them needs both a backend dispatch and a frontend
  consumer — currently no UI surfaces them.
- **The poll loop is fixed at 100 ms**
  (`src-tauri/src/main.rs:91`). It's a low number for HID and a high number
  for UI latency on broadcasts; fine for current usage, worth revisiting if
  the broadcast volume grows.
- **No reconnect-on-error**. If a device errors mid-session, the next
  enumerate cycle treats it as gone. There's a TODO in `enumerate_xap_devices`
  for "Device already enumerated but error occurred — restart device".
- **Layout selection is naive**. `KeymapView.vue::onMounted` picks
  `getLayouts()[0]` and never offers a UI for choosing a different one
  beyond the `q-select` dropdown. For boards with many layouts, the first
  may not be the right default.
- **Multi-device is partially wired**. The Pinia store supports a `devices`
  map and auto-selection on add/remove, but the UI currently shows only the
  `device` field's view. Switching between concurrently-connected devices
  would need a selector somewhere visible (toolbar, sidebar).
