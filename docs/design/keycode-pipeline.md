# Keycode pipeline

End-to-end coverage of how QMK keycodes flow from upstream into the picker UI
and back out to the firmware. Spans:

- the versioned catalog under `xap-specs/assets/`,
- the decoder (`keycode_decoder.rs`) and encoder (`keycode_encoder.rs`),
- the display engine (`keycode_display.rs`) that turns the catalog into the
  picker's tab/subgroup layout,
- the Vue picker UI in `src/pages/KeymapView.vue`,
- and the two-step "pending assignment" flow for parameterized keycodes (MT,
  LT, LM, QK_MODS).

## Data flow

```
QMK upstream                  build-time             runtime
─────────────────             ──────────────         ────────────────────
quantum/keycodes.h            sync_keycodes.py       XapConstants::new
quantum/modifiers.h    ──►    (yarn sync:keycodes)
quantum/keycodes/             writes versioned       ┌────────────────────┐
  *.hjson                     hjson into             │ read_xap_keycode_  │
                              xap-specs/assets/      │   catalog          │
                                                     │ (keycode.rs)       │
                                                     └─────────┬──────────┘
                                                               │
                                          ┌────────────────────┼────────────────────┐
                                          │                    │                    │
                                          ▼                    ▼                    ▼
                                  versions_by_name      apply_overrides       build_view_for_
                                  (lookup tables)       (display.hjson →      version
                                                         labels + hidden set)  (keycode_display
                                                                                 .rs)
                                                                                       │
                                                                                       ▼
                                                                          XapConstants.keycode_view
                                                                                       │
                                                                  ┌────────────────────┘
                                                                  │ Tauri command
                                                                  ▼ xap_constants_get
                                                          KeymapView.vue
                                                          (picker + pending state)
                                                                  │
                                                                  ▼
                                                    keycodeTemplateEncode → remapKey
                                                                  │ Tauri command
                                                                  ▼ wire u16
                                                          XapDevice.remap_key
                                                                  │ USB HID
                                                                  ▼
                                                          QMK firmware
```

## Catalog

### Source files

`xap-specs/assets/keycodes_X.Y.Z.generated.hjson` — one fully-resolved
catalog per QMK keycode spec version. Currently 0.0.1 → 0.0.8. The shape:

```hjson
{
    "version": "0.0.8",
    "keycodes": {
        "0x0004": {
            "group": "basic",
            "key":   "KC_A",
            "label": "A",
            "aliases": []
        },
        // ...
    }
}
```

The "latest" version is whichever sort-largest semver entry exists. The
backend exposes both the latest catalog and per-version lookup via
`XapKeyCodeCatalog` in `xap-specs/src/constants/keycode.rs`.

### Regenerating from QMK

```sh
yarn sync:keycodes --qmk-firmware /path/to/qmk_firmware
```

Delegates to `xap-specs/scripts/sync_keycodes.py`, which uses QMK's own loader
to handle `!delete!` / `!reset!` directives across versions and writes one
fully-merged file per version. Don't hand-edit the generated files.

### `KeyCode` struct

Defined in `xap-specs/src/constants/keycode.rs`. Both catalog entries and
decoder output share this struct:

| Field         | Source                                                |
| ------------- | ----------------------------------------------------- |
| `code`        | u16 keycode value                                     |
| `key`         | QMK identifier (`KC_A`, `QK_MOUSE_CURSOR_UP`)         |
| `group`       | QMK category (`basic`, `modifiers`, `mouse`, ...)     |
| `label`       | Display string. Overrides from `keycode_display.hjson` land here |
| `top`/`bottom`| Set for parameterized keys with a split visual (MT, LT, LM) |
| `aliases`     | Alternate identifiers from QMK                        |
| `description` | Populated by `keycode_display.hjson` overrides        |
| `template`    | Populated by the decoder for parameterized values     |

The `template` field is `Option<KeycodeTemplate>` and **only set by the
decoder** — catalog hjson never sets it.

## Display engine

`keycode_display.hjson` (in `xap-specs/assets/`) controls what the picker
looks like. The engine lives in `xap-specs/src/constants/keycode_display.rs`.

### Schema (top level)

```hjson
{
    "version": "1",                          // schema version (independent of QMK)
    "target_keycode_version": "0.0.8",       // remap only applies on match
    "tabs": [ ... ],
    "keycodes": { "KC_A": { ... }, ... }     // per-key overrides
}
```

### Tab + subgroup shape

```hjson
{
    "id": "layer",
    "label": "Layer",
    "color": "blue",                         // family tint (optional)
    "subgroups": [
        { "id": "ansi", "render_mode": "ansi", "from_groups": ["basic","modifiers"] },
        { "id": "extended_f", "keys": ["KC_F13", "KC_F14", ...] },
        { "id": "mo", "label": "Momentary", "template": { "kind": "MO" } },
        { "id": "mt", "template": { "kind": "MT", "mods": ["LSFT","LCTL", ...] } }
    ]
}
```

A subgroup picks its codes via **one** of:

- **`render_mode: "ansi"`** + `from_group(s)` — rendered as the ANSI keyboard
  layout via `src/components/BasicKeyboardLayout.vue`.
- **`keys: [...]`** — explicit list. Always wins over `from_group` for the
  same code, regardless of declaration order (two-pass claim algorithm in
  `build_remapped_view`).
- **`from_group: "X"` / `from_groups: ["X","Y"]`** — sweeps the catalog for
  keycodes whose `group` matches and that haven't been claimed by an explicit
  `keys` list yet.
- **`template: { kind, ... }`** — parameterized subgroup; the frontend
  expands buttons at render time using the connected keyboard's layer count.

Supported template kinds: `MO`, `TG`, `TO`, `DF`, `OSL`, `TT`, `PDF`, `LT`,
`LM`, `MT { mods }`, `QK_MODS { mods }`.

### Per-key overrides

```hjson
"keycodes": {
    "KC_A":          { "description": "a and A" },
    "RGB_MODE_PLAIN":{ "label": "Solid", "description": "Solid colour RGB mode" },
    "KC_NO":         { "hidden": true, "description": "Ignore this key (NOOP)." }
}
```

- `label` replaces `KeyCode.label`. Both the picker (`code.label ?? code.key`)
  and the keymap layer view automatically pick up the new label.
- `description` populates `KeyCode.description`, surfaced in tooltips.
- `hidden: true` routes the key to a synthesised "Hidden" tab. The keycode is
  still in the catalog, so an existing keymap bound to it renders with its
  (possibly overridden) label.

### Why scope to one target version?

QMK keycode names and even hex codes drift between versions (e.g. `KC_MS_UP`
in 0.0.1 became `QK_MOUSE_CURSOR_UP` in 0.0.8). Maintaining cross-version
overrides would be a permanent tax. Instead: the display file declares a
single `target_keycode_version`. When the active catalog matches, the full
remap applies. When it doesn't, the engine emits a raw view (one tab per
generated `group`, all flagged `is_fallback: true`) so the GUI keeps working.
See `build_raw_view` and `build_view_for_version` in `keycode_display.rs`.

## Decoder

`xap-specs/src/constants/keycode_decoder.rs` handles parameterized keycodes
that don't exist in the catalog as concrete entries — everything in the
QMK ranges:

| Range start  | What it is                                          |
| ------------ | --------------------------------------------------- |
| `0x0100`     | `QK_MODS` (Modifier + base kc: `LSFT(A)`, `MEH(A)`) |
| `0x2000`     | `QK_MOD_TAP` (`LSFT_T(A)`, `MEH_T(A)`)              |
| `0x4000`     | `QK_LAYER_TAP` (`LT(N, kc)`)                        |
| `0x5000`     | `QK_LAYER_MOD` (`LM(N, mod)`)                       |
| `0x5200..`   | One-shot layer ops + OSM (`TO`, `MO`, `DF`, `TG`, `OSL`, `OSM`, `TT`, `PDF`) |

`decode_parameterized(code, lookup) -> Option<KeyCode>` returns a synthesised
`KeyCode` with:

- `label` — combined macro form (`LSFT_T(A)`, `LM(3, LCS)`)
- `top` / `bottom` — split fields for MT / LT / LM (used by the keymap view
  to render a split key)
- `template` — the typed `KeycodeTemplate` the encoder mirrors

The decoder is called from `XapKeyCodeCatalog::get_keycode` whenever a raw
keycode isn't in the catalog lookup.

## Encoder

`xap-specs/src/constants/keycode_encoder.rs` is the inverse of the decoder.
Owns the canonical QMK bit-pattern constants (in `consts` submodule) and the
`KeycodeTemplate` enum.

```rust
pub enum LayerOp { MO, TG, TO, DF, OSL, TT, PDF }

#[serde(tag = "kind")]
pub enum KeycodeTemplate {
    LayerOp     { op: LayerOp, layer: u8 },
    OneShotMod  { mod_mask: u8 },
    LayerTap    { layer: u8,    tap_kc:  Option<u8> },
    ModTap      { mod_mask: u8, tap_kc:  Option<u8> },
    LayerMod    { layer: u8,    mod_mask: Option<u8> },
    Modified    { mod_mask: u8, base_kc:  Option<u8> },
}
```

`encode(&self) -> Option<u16>` returns `Some` only when every slot is filled.
The frontend uses this via the `keycode_template_encode` Tauri command, so it
never does bit math itself.

### Verifying against QMK

Three layers of defence, all in
`xap-specs/src/constants/keycode_encoder.rs::tests`:

1. **`fixed_value_table`** — hardcoded `(template, expected u16)` rows with
   a comment citing the QMK source line for each. Reviewers can hand-verify
   the table without reading the rest.
2. **`encode_decode_round_trip`** — every encodable template is encoded then
   re-decoded; the resulting `KeyCode.template` must equal the input. Catches
   any asymmetry between encoder and decoder.
3. **`qmk_header_constants_match_local`** — reads
   `qmk_firmware_ref/quantum/keycodes.h` and `modifiers.h` at test time,
   regex-extracts the `QK_*` / `MOD_*` constants, and asserts they match the
   local copies. Fails loudly if upstream renumbers or renames anything.

If QMK upstream changes a bit layout: this test fails, you update the
constants in `keycode_encoder.rs::consts` and the corresponding ranges in
`keycode_decoder.rs`, and the round-trip + fixed-value tests catch any
follow-on mistake.

## Picker UI

`src/pages/KeymapView.vue` is the main consumer. It reads
`xapConstants.keycode_view.tabs` and walks the tab/subgroup tree:

- **`render_mode: 'ansi'`** subgroup → renders via `BasicKeyboardLayout.vue`.
- **`subgroup.template` set** → calls `expandTemplate(subgroup.template)`
  which returns one button per layer or per mod, depending on kind. Layer
  count comes from `keymap?.keys.length`.
- **Otherwise** → renders `subgroup.codes` as a grid (capped at 16 columns
  via `.keycode-grid` CSS).

### Family colour tints

Tabs declare a `color`. The frontend maps `'blue' | 'purple' | 'cyan' |
'orange'` to `.family-layer | -modtap | -layermod | -modified` CSS classes
applied to picker buttons. The keymap layer view also tints bound keys by
inspecting `code.template?.kind` (e.g. `ModTap` → purple). Same classes,
same colours.

### Two-step pending flow

When the user clicks a *complete* template (any `LayerOp`):

1. `applyTemplate(template, position)` calls `keycodeTemplateEncode` →
   `remapKey` → `updateKeymap`. One round trip; firmware updated.

When the user clicks an *incomplete* template (MT / LT / LM / QK_MODS):

1. `startTemplate(button)` sets `pendingAssignment = { position, template,
   origin: 'picker' }`. No firmware write yet.
2. A banner appears under the keymap explaining what to pick next.
3. The target key in the keymap renders with a dashed pulse and `...` in the
   bottom half (`.pending-key` CSS).
4. The user's next picker click is intercepted by `remapKey`. If the
   template needs a basic kc (MT/LT/QK_MODS), `code & 0xFF` fills the slot.
   For LM, the picker is replaced by a mod-only mini-picker (`fillLayerModMod`).
5. The completed template is encoded and written. `pendingAssignment` clears.

**Cancellation** routes:

- `Esc` key (global listener in `onMounted`)
- Click another keymap position (`selectPosition` calls `cancelPending`)
- Banner "Cancel" button

All cancellations clear pending without touching the firmware and emit a
yellow `notifyInfo` toast. The encode command is a backstop: it refuses
incomplete templates.

### Editing the tap slot of an existing key

The bottom span of a split key (MT/LT/LM) has its own `@click.stop` handler
(`selectBottomHalf`). Clicking it:

1. Reads `col.key.code.template`.
2. Clones it with `tap_kc: null` (or `mod_mask: null` for LM).
3. Sets `pendingAssignment` with that incomplete template + `origin:
   'tap-slot'`.

The user can now pick a new tap key without overwriting the hold side.

QK_MODS keys don't render as split today (the decoder emits a single label
like `LSFT(A)`), so the bottom-half edit isn't available for them — see
[Known limits](#known-limits).

## Common changes

### Add or change a keycode label / description

1. Edit the `keycodes` object in `xap-specs/assets/keycode_display.hjson`.
   Use the exact `key` field from the target version's
   `keycodes_X.Y.Z.generated.hjson`.
2. Run `touch src-tauri/tauri.conf.json` so Tauri re-stages the asset for
   dev mode (see [`type-bridge.md`](type-bridge.md#asset-staging-in-dev)).
3. Restart `yarn tauri dev`. The picker + keymap view both pick up the new
   label.

### Hide a noisy keycode

```hjson
"keycodes": {
    "KC_NO": { "hidden": true, "description": "Ignore this key (NOOP)." }
}
```

The key disappears from its normal tab, surfaces in the synthesised "Hidden"
tab, and continues to render with its label in the keymap.

### Add a new picker tab

Edit `keycode_display.hjson`:

```hjson
{
    "id": "my-tab",
    "label": "My Tab",
    "color": "purple",                  // optional family tint
    "subgroups": [
        { "id": "rare-keys", "keys": ["KC_FOO", "KC_BAR"] }
    ]
}
```

### Add a new template subgroup

Pick from the existing template kinds (MO/TG/TO/DF/OSL/TT/PDF/LT/LM, or
MT/QK_MODS with a `mods: [...]` list). No code changes needed.

### Bump `target_keycode_version`

1. Make sure the matching `keycodes_X.Y.Z.generated.hjson` exists (run
   `yarn sync:keycodes` if not).
2. Update `target_keycode_version` in `keycode_display.hjson`.
3. Walk the `keycodes` overrides — any names that no longer exist in the new
   catalog will warn (`apply_overrides` logs them via `log::warn!`).

### Add a new template *kind* (e.g., tap-dance)

Heavier change — touches Rust + TS + hjson:

1. **Rust encoder** (`keycode_encoder.rs`): add the variant to
   `KeycodeTemplate`, the encoding rule to `encode()`, and a row to
   `fixed_value_table` with a QMK source citation.
2. **Rust decoder** (`keycode_decoder.rs`): if the new kind has a wire form,
   add range detection in `decode_parameterized` and emit `template:
   Some(...)`.
3. **Display schema** (`keycode_display.rs`): add the variant to
   `SubgroupTemplate`. Frontend types in `src/generated/xap.ts` regenerate at
   next `yarn tauri dev`.
4. **Frontend** (`KeymapView.vue`): extend `expandTemplate` to render the
   new subgroup type; extend `remapKey` and `selectBottomHalf` to handle the
   new slot if any.
5. **hjson** (`keycode_display.hjson`): add a subgroup declaring the new
   template kind.
6. Add round-trip and fixed-value tests in `keycode_encoder.rs::tests`.

## Verification

- `cargo test -j8 -p xap-specs` — covers catalog loading, decoder, encoder
  (all three QMK-drift layers), and display engine. Should always pass before
  committing keycode-related changes.
- `yarn ts-check` — verifies the frontend agrees with the regenerated TS
  types in `src/generated/xap.ts`.
- For end-to-end behaviour, `yarn tauri dev` with a connected keyboard. Drop
  test keys, watch the pending banner, click bottom halves, cancel via Esc /
  Cancel button / clicking another key.

## Known limits

- **Parameterized template picker is not yet hardware-tested.** The Rust
  encode/decode round-trip is exhaustive and the QMK constants are pinned by
  the drift test, but `commands.keycodeTemplateEncode` + `commands.remapKey`
  has not been verified against a real QMK board as of writing. Validate
  Esc/Cancel cancellation, the LM mini-picker mod choice, and that the
  bottom-half re-edit preserves the hold side before relying on it.
- **QK_MODS keys are not split.** The decoder emits a single label like
  `LSFT(A)` rather than `top: "LSFT"` / `bottom: "A"`. As a result the
  bottom-half edit doesn't apply to QK_MODS — the user must overwrite the
  whole position. Promoting them to split is straightforward (mirror the
  `mod_tap` helper in `keycode_decoder.rs:109`) if the UX warrants it.
- **OSM is decoded but not in the picker.** One-shot modifiers (`OSM(LSFT)`,
  etc.) get a `KeycodeTemplate::OneShotMod` from the decoder and render
  correctly in the keymap, but `keycode_display.hjson` doesn't expose them
  as a picker template. The QMK firmware has a handful of named OS_* keys
  in the catalog already, which is probably enough; add an OSM template
  subgroup if not.
- **LM step-2 mod list is hardcoded in the frontend.** `LM_MOD_OPTIONS` in
  `KeymapView.vue` is a fixed list, independent of MT's `mods` array in the
  hjson. Worth unifying if the lists diverge in practice.
- **Layer count is read from `keymap?.keys.length`.** If the user opens the
  picker before a keymap is loaded, layer-templated subgroups show an
  "connect a device" hint. The first keymap fetch fills them in.
