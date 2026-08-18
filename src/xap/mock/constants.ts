import type {
  XapConstants,
  KeycodeViewTab,
  KeycodeViewSubgroup,
  KeyCode,
} from '../types'

// ---------------------------------------------------------------------------
// Basic tab — ANSI letters, digits, specials, mods
// ---------------------------------------------------------------------------

function kc(key: string, label: string, group?: string, cap_label?: string): KeyCode {
  return { key, label, group: group ?? null, ...(cap_label !== undefined ? { cap_label } : {}) }
}

const basicCodes: KeyCode[] = [
  // Letters A-Z
  ...('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => kc(`KC_${l}`, l))),
  // Digits 0-9
  ...('0123456789'.split('').map((d) => kc(`KC_${d}`, d))),
  // Specials
  kc('KC_ENTER', 'Enter'),
  kc('KC_TAB', 'Tab'),
  kc('KC_ESC', 'Esc'),
  kc('KC_SPACE', 'Space'),
  kc('KC_BACKSPACE', 'Backspace', undefined, 'Back\nSpace'),
  // Modifiers
  kc('KC_LSFT', 'LShift'),
  kc('KC_RSFT', 'RShift'),
  kc('KC_LCTL', 'LCtrl'),
  kc('KC_RCTL', 'RCtrl'),
  kc('KC_LALT', 'LAlt'),
  kc('KC_RALT', 'RAlt'),
  kc('KC_LGUI', 'LGui'),
  kc('KC_RGUI', 'RGui'),
  // Function keys
  kc('KC_F1', 'F1'),
  kc('KC_F2', 'F2'),
  kc('KC_F3', 'F3'),
  kc('KC_F4', 'F4'),
  kc('KC_F5', 'F5'),
  kc('KC_F6', 'F6'),
  kc('KC_F7', 'F7'),
  kc('KC_F8', 'F8'),
  kc('KC_F9', 'F9'),
  kc('KC_F10', 'F10'),
  kc('KC_F11', 'F11'),
  kc('KC_F12', 'F12'),
  // Punctuation
  kc('KC_GRV', '`'),
  kc('KC_MINS', '-'),
  kc('KC_EQL', '='),
  kc('KC_LBRC', '['),
  kc('KC_RBRC', ']'),
  kc('KC_BSLS', '\\'),
  kc('KC_SCLN', ';'),
  kc('KC_QUOT', "'"),
  kc('KC_COMM', ','),
  kc('KC_DOT', '.'),
  kc('KC_SLSH', '/'),
  // Caps Lock
  kc('KC_CAPS', 'Caps'),
  // Navigation cluster
  kc('KC_INS', 'Ins'),
  kc('KC_HOME', 'Home'),
  kc('KC_PGUP', 'PgUp'),
  kc('KC_DEL', 'Del'),
  kc('KC_END', 'End'),
  kc('KC_PGDN', 'PgDn'),
  // Arrow keys
  kc('KC_UP', 'Up'),
  kc('KC_DOWN', 'Down'),
  kc('KC_LEFT', 'Left'),
  kc('KC_RGHT', 'Right'),
  // System keys
  kc('KC_PSCR', 'PrtSc'),
  kc('KC_SCRL', 'ScrLk'),
  kc('KC_PAUS', 'Pause'),
  kc('KC_APP', 'Menu'),
  // Numpad
  kc('KC_NUM', 'NumLk'),
  kc('KC_PSLS', 'N/'),
  kc('KC_PAST', 'N*'),
  kc('KC_PMNS', 'N-'),
  kc('KC_PPLS', 'N+'),
  kc('KC_PENT', 'NEnter'),
  kc('KC_P0', 'N0'),
  kc('KC_P1', 'N1'),
  kc('KC_P2', 'N2'),
  kc('KC_P3', 'N3'),
  kc('KC_P4', 'N4'),
  kc('KC_P5', 'N5'),
  kc('KC_P6', 'N6'),
  kc('KC_P7', 'N7'),
  kc('KC_P8', 'N8'),
  kc('KC_P9', 'N9'),
  kc('KC_PDOT', 'N.'),
]

const basicSubgroup: KeycodeViewSubgroup = {
  id: 'basic_ansi',
  label: 'ANSI',
  render_mode: 'ansi',
  is_fallback: false,
  codes: basicCodes,
  template: null,
}

const basicTab: KeycodeViewTab = {
  id: 'basic',
  label: 'Basic',
  is_fallback: false,
  color: null,
  subgroups: [basicSubgroup],
}

// ---------------------------------------------------------------------------
// Layer tab — template subgroups (codes empty, expanded at render)
// ---------------------------------------------------------------------------

function templateSubgroup(id: string, label: string, kind: string): KeycodeViewSubgroup {
  return {
    id,
    label,
    render_mode: null,
    is_fallback: false,
    codes: [],
    template: { kind } as KeycodeViewSubgroup['template'],
  }
}

const layerTab: KeycodeViewTab = {
  id: 'layer',
  label: 'Layer',
  is_fallback: false,
  color: '#93c5fd',
  subgroups: [
    templateSubgroup('layer_mo', 'MO (Momentary)', 'MO'),
    templateSubgroup('layer_tg', 'TG (Toggle)', 'TG'),
    templateSubgroup('layer_to', 'TO (On)', 'TO'),
    templateSubgroup('layer_lt', 'LT (Layer Tap)', 'LT'),
  ],
}

// ---------------------------------------------------------------------------
// Mod-Tap tab
// ---------------------------------------------------------------------------

const modtapTab: KeycodeViewTab = {
  id: 'modtap',
  label: 'Mod-Tap',
  is_fallback: false,
  color: '#c4b5fd',
  subgroups: [
    {
      id: 'modtap_mt',
      label: 'MT (Mod-Tap)',
      render_mode: null,
      is_fallback: false,
      codes: [],
      template: { kind: 'MT', mods: ['LCTL', 'LSFT', 'LALT', 'LGUI', 'MEH', 'HYPR'] },
    },
    templateSubgroup('modtap_osl', 'OSL (One-Shot Layer)', 'OSL'),
  ],
}

// ---------------------------------------------------------------------------
// Layer-Mod tab
// ---------------------------------------------------------------------------

const layermodTab: KeycodeViewTab = {
  id: 'layermod',
  label: 'Layer+Mod',
  is_fallback: false,
  color: '#67e8f9',
  subgroups: [templateSubgroup('layermod_lm', 'LM (Layer+Mod)', 'LM')],
}

// ---------------------------------------------------------------------------
// Modified tab
// ---------------------------------------------------------------------------

const modifiedTab: KeycodeViewTab = {
  id: 'modified',
  label: 'Modified',
  is_fallback: false,
  color: '#fdba74',
  subgroups: [
    {
      id: 'modified_qk',
      label: 'Modified Key',
      render_mode: null,
      is_fallback: false,
      codes: [],
      template: { kind: 'QK_MODS', mods: ['LSFT', 'LCTL', 'LALT', 'RALT'] },
    },
  ],
}

// ---------------------------------------------------------------------------
// Lighting tab
// ---------------------------------------------------------------------------

const lightingCodes: KeyCode[] = [
  { key: 'RGB_TOG',  label: 'RGB Toggle',    group: 'rgb' },
  { key: 'RGB_MOD',  label: 'RGB Mode+',     group: 'rgb' },
  { key: 'RGB_RMOD', label: 'RGB Mode-',     group: 'rgb' },
  { key: 'RGB_HUI',  label: 'Hue+',          group: 'rgb' },
  { key: 'RGB_HUD',  label: 'Hue-',          group: 'rgb' },
  { key: 'RGB_SAI',  label: 'Sat+',          group: 'rgb' },
  { key: 'RGB_SAD',  label: 'Sat-',          group: 'rgb' },
  { key: 'RGB_VAI',  label: 'Val+',          group: 'rgb' },
  { key: 'RGB_VAD',  label: 'Val-',          group: 'rgb' },
]

const lightingTab: KeycodeViewTab = {
  id: 'lighting',
  label: 'Lighting',
  is_fallback: false,
  color: null,
  subgroups: [
    {
      id: 'lighting_rgb',
      label: 'RGB',
      render_mode: null,
      is_fallback: false,
      codes: lightingCodes,
      template: null,
    },
  ],
}

// ---------------------------------------------------------------------------
// Exported fixture
// ---------------------------------------------------------------------------

export const ugoConstants: XapConstants = {
  keycode_version: '0.0.1',
  keycode_versions: ['0.0.1'],
  keycode_view: {
    tabs: [basicTab, layerTab, modtapTab, layermodTab, modifiedTab, lightingTab],
  },
  rgblight_modes: { groups: null, effects: {} },
  rgb_matrix_modes: { groups: null, effects: {} },
  led_matrix_modes: { groups: null, effects: {} },
}
