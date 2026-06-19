import type {
  XapDeviceState,
  MappedKeymap,
  MappedKeymapKey,
  KeyCode,
  LayoutEntry,
} from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entry(row: number, col: number, x: number, y: number, opts?: Partial<LayoutEntry>): LayoutEntry {
  return { matrix: { y: BigInt(row), x: BigInt(col) }, x, y, ...opts }
}

function mk(code: KeyCode, layoutEntry: LayoutEntry): MappedKeymapKey {
  return {
    key: {
      code,
      position: {
        x: layoutEntry.matrix.x,
        y: layoutEntry.matrix.y,
        z: 0n,
      },
    },
    layout: layoutEntry,
  }
}

// ---------------------------------------------------------------------------
// Layout entries (real ugo_rev3_full positions, abridged)
// row 3: A S D F  (matrix cols 3-6, x 3-6, y 3)
// row 5: M1 M2 M3 (matrix cols 0-2, x 0-2, y 5)  — macro/layer keys
// ---------------------------------------------------------------------------

const ENTRIES = {
  A:   entry(3, 3, 3,    3),    // basic key
  S:   entry(3, 4, 4,    3),    // ModTap
  D:   entry(3, 5, 5,    3),    // LayerTap
  F:   entry(3, 6, 6,    3),    // Modified (shifted)
  M1:  entry(5, 0, 0,    5),    // LayerOp MO(1)
  M2:  entry(5, 1, 1.25, 5),    // KC_TRNS (on layer 1)
  M3:  entry(5, 2, 2.25, 5),    // KC_NO
} satisfies Record<string, LayoutEntry>

// ---------------------------------------------------------------------------
// Keycodes covering every legend kind
// ---------------------------------------------------------------------------

// 1. Basic key — no group so legendOf returns { kind: 'basic' } not prefix
const KC_A: KeyCode = { code: 4, key: 'KC_A', label: 'A' }

// 2. ModTap: hold=Left Ctrl, tap=S  (mod_mask=0x01 = MOD_LCTL)
const MT_LCTL_S: KeyCode = {
  code: 0x6104,   // MT(MOD_LCTL, KC_S) — approximate
  key: 'MT(MOD_LCTL,KC_S)',
  label: 'S',
  top: 'Ctrl',
  group: 'ModTap',
  template: { kind: 'ModTap', mod_mask: 0x01, tap_kc: 0x16 },
}

// 3. LayerTap: hold=layer 1, tap=D
const LT_1_D: KeyCode = {
  code: 0x4103,
  key: 'LT(1,KC_D)',
  label: 'D',
  bottom: 'L1',
  group: 'LayerTap',
  template: { kind: 'LayerTap', layer: 1, tap_kc: 0x07 },
}

// 4. Modified: Shift+1 = !
const S_KC_1: KeyCode = {
  code: 0x021e,
  key: 'S(KC_1)',
  label: '!',
  group: 'Modified',
  template: { kind: 'Modified', mod_mask: 0x02, base_kc: 0x1e },
}

// 5. LayerOp: MO(1)
const MO_1: KeyCode = {
  code: 0x5101,
  key: 'MO(1)',
  label: 'MO',
  bottom: '1',
  group: 'Layers',
  template: { kind: 'LayerOp', op: 'MO', layer: 1 },
}

// 6. KC_TRNS (transparent)
const KC_TRNS: KeyCode = { code: 1, key: 'KC_TRNS', label: '▽', group: 'Special' }

// 7. KC_NO (blocked/intentionally empty)
const KC_NO: KeyCode = { code: 0, key: 'KC_NO', label: '', group: 'Special' }

// ---------------------------------------------------------------------------
// Keymap layout
// Layer 0: A, MT, LT, Modified, MO  (row 3 pos 3-6, row 5 pos 0)
// Layer 1: TRNS, TRNS, TRNS, TRNS, TRNS, TRNS(same), NO  (same positions)
// Represented as keys[layer][row][col] where sparse slots are null.
// We use a 2D structure: row index = matrix row, col index = matrix col.
// ---------------------------------------------------------------------------

// Build a sparse row array of length 16 filled with null
function sparseRow(fills: Array<[number, MappedKeymapKey | null]>): (MappedKeymapKey | null)[] {
  const row: (MappedKeymapKey | null)[] = Array(16).fill(null)
  for (const [col, key] of fills) {
    row[col] = key
  }
  return row
}

// Layer 0 — row 3 (cols 3-6) and row 5 (cols 0)
// We only include the rows that have keys; other rows are null arrays.
function sparseLayer0(): (MappedKeymapKey | null)[][] {
  const rows: (MappedKeymapKey | null)[][] = Array.from({ length: 7 }, () =>
    Array(16).fill(null),
  )
  rows[3] = sparseRow([
    [3, mk(KC_A,      ENTRIES.A)],
    [4, mk(MT_LCTL_S, ENTRIES.S)],
    [5, mk(LT_1_D,    ENTRIES.D)],
    [6, mk(S_KC_1,    ENTRIES.F)],
  ])
  rows[5] = sparseRow([
    [0, mk(MO_1, ENTRIES.M1)],
  ])
  return rows
}

function sparseLayer1(): (MappedKeymapKey | null)[][] {
  const rows: (MappedKeymapKey | null)[][] = Array.from({ length: 7 }, () =>
    Array(16).fill(null),
  )
  rows[3] = sparseRow([
    [3, mk(KC_TRNS, ENTRIES.A)],
    [4, mk(KC_TRNS, ENTRIES.S)],
    [5, mk(KC_TRNS, ENTRIES.D)],
    [6, mk(KC_TRNS, ENTRIES.F)],
  ])
  rows[5] = sparseRow([
    [0, mk(KC_TRNS, ENTRIES.M1)],
    [1, mk(KC_TRNS, ENTRIES.M2)],
    [2, mk(KC_NO,   ENTRIES.M3)],
  ])
  return rows
}

// ---------------------------------------------------------------------------
// Exported fixtures
// ---------------------------------------------------------------------------

export const ugoState: XapDeviceState = {
  id: 'ugo_rev3_full',
  info: {
    xap: { version: 0x0200 },
    qmk: {
      version: '0.0.1',
      board_ids: {
        vendor_id: 0xfeed,
        product_id: 0xa504,
        product_version: 1,
        qmk_unique_identifier: 0,
      },
      manufacturer: '[SIM] UGO Native Sim',
      product_name: '[SIM] Protok Keyboard Model II Full Native Sim',
      hardware_id: '0000000000000000',
      jump_to_bootloader_enabled: true,
      eeprom_reset_enabled: true,
    },
    keymap: {
      layer_count: 8,
      get_keycode_enabled: true,
      get_encoder_keycode_enabled: true,
    },
    remap: null,
    lighting: null,
  },
  config: {
    layouts: {
      LAYOUT_gen2: {
        layout: Object.values(ENTRIES),
      },
    },
    matrix_size: { y: 7n, x: 16n },
    encoder: {
      enabled: true,
      rotary: [
        { pin_a: 'B15', pin_b: 'B14', resolution: 2 },
        { pin_a: 'B13', pin_b: 'B12', resolution: 2 },
        { pin_a: 'A9',  pin_b: 'A8',  resolution: 1 },
      ],
    },
    encoder_count: 3,
  },
  config_json: '{"keyboard_name":"Protok Model II","tapping":{"tapping_term":200,"permissive_hold":true},"rgb_matrix":{"animations":{"solid_color":true},"max_brightness":150},"matrix_pins":{"rows":["B0","B1","B2","B3","B4","B5","B6"],"cols":["C0","C1","C2","C3","C4","C5","C6","C7","C8","C9","C10","C11","C12","C13","C14","C15"]}}',
  secure_status: 'Unlocked',
}

export const miniState: XapDeviceState = {
  id: 'mini40_locked',
  info: {
    xap: { version: 0x0200 },
    qmk: {
      version: '0.0.1',
      board_ids: {
        vendor_id: 0xfeed,
        product_id: 0xa505,
        product_version: 1,
        qmk_unique_identifier: 0,
      },
      manufacturer: '[SIM] UGO Native Sim',
      product_name: '[SIM] Mini 40% Sim',
      hardware_id: '1111111111111111',
      jump_to_bootloader_enabled: true,
      eeprom_reset_enabled: false,
    },
    keymap: {
      layer_count: 4,
      get_keycode_enabled: true,
      get_encoder_keycode_enabled: false,
    },
    remap: null,
    lighting: null,
  },
  config: {
    layouts: {
      LAYOUT_gen2: {
        layout: Object.values(ENTRIES),
      },
    },
    matrix_size: { y: 7n, x: 16n },
    encoder_count: 0,
  },
  config_json: '{"keyboard_name":"Mini 40%","tapping":{"tapping_term":175}}',
  secure_status: 'Locked',
}

export const ugoKeymap: MappedKeymap = {
  keys: [sparseLayer0(), sparseLayer1()],
  dimensions: { x: 16n, y: 7n, z: 2n },
  size: { x: 16n, y: 7n },
}
