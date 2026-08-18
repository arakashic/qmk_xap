import type { KeyCode } from '@/xap/types'

export type Family = 'layer' | 'modtap' | 'layermod' | 'modified' | null

export type LegendModel =
  | { kind: 'basic'; label: string; top?: string }
  | { kind: 'split'; family: 'layer' | 'modtap'; hold: string; tap: string }
  | { kind: 'descriptor'; family: Family; verb: string; payload: string }
  | { kind: 'prefix'; tag: string; payload: string }
  | { kind: 'modified'; output: string; corner: string }
  | { kind: 'trns' }
  | { kind: 'no' }
  | { kind: 'hex'; code: number }

const LAYER_OP_VERB: Record<string, string> = {
  MO: 'momentary',
  TG: 'toggle',
  TO: 'go to',
  DF: 'default',
  OSL: 'one-shot',
  TT: 'tap-toggle',
  PDF: 'default ✎',
}

// QMK mod bitmask: bits 0-3 = L{Ctrl,Sft,Alt,GUI}, bits 4-7 = R{Ctrl,Sft,Alt,GUI}
// Meh  = Ctrl+Sft+Alt (0x07 or 0x70)
// Hyper = Ctrl+Sft+Alt+GUI (0x0F or 0xF0)
export function modName(mod_mask: number): string {
  const l = mod_mask & 0x0f
  const r = mod_mask & 0xf0

  // Combine left and right halves, right mods get an "R" prefix on individual bits
  const active = l | (r >> 4)

  // Named combos (check before individual bits)
  if (active === 0x0f) return 'Hyper'
  if (active === 0x07) return 'Meh'

  const names: string[] = []
  if (active & 0x01) names.push(r & 0x10 ? 'RCtrl' : 'Ctrl')
  if (active & 0x02) names.push(r & 0x20 ? 'RShift' : 'Shift')
  if (active & 0x04) names.push(r & 0x40 ? 'RAlt' : 'Alt')
  if (active & 0x08) names.push(r & 0x80 ? 'RGUI' : 'GUI')

  return names.length > 0 ? names.join('+') : `0x${mod_mask.toString(16).toUpperCase()}`
}

// Short form for OSM payload labels (matches design §2.5 OSM caps)
function modNameShort(mod_mask: number): string {
  const l = mod_mask & 0x0f
  const r = mod_mask & 0xf0
  const active = l | (r >> 4)

  if (active === 0x0f) return 'Hyper'
  if (active === 0x07) return 'Meh'

  const names: string[] = []
  if (active & 0x01) names.push('Ctl')
  if (active & 0x02) names.push('Sft')
  if (active & 0x04) names.push('Alt')
  if (active & 0x08) names.push('GUI')

  return names.length > 0 ? names.join('+') : `0x${mod_mask.toString(16).toUpperCase()}`
}

// Transparent / no-op keys: the real catalog decodes these to their canonical
// names (KC_TRANSPARENT / KC_NO) with KC_TRNS as an alias, while the mock used
// the KC_TRNS short form. Match all representations (name, alias, or u16 0x0001/
// 0x0000) so the striped ▽ / dotted styles render against real firmware too.
function isTransparent(code: KeyCode): boolean {
  return code.key === 'KC_TRNS' || code.key === 'KC_TRANSPARENT' || (code.aliases?.includes('KC_TRNS') ?? false) || code.code === 0x0001
}
function isNoOp(code: KeyCode): boolean {
  return code.key === 'KC_NO' || (code.aliases?.includes('KC_NO') ?? false) || code.code === 0x0000
}

// Tap zone of a split cap. The decoder puts the tap keycode's own label in
// `bottom`; `label` holds the combined macro form (e.g. "LCTL_T(S)"), which
// must not leak into the tap zone.
function tapLabel(code: KeyCode, tap_kc: number | null): string {
  return code.bottom ?? code.label ?? String(tap_kc ?? '?')
}

export function legendOf(code: KeyCode): LegendModel {
  // Special transparent / no-op keys
  if (isTransparent(code)) return { kind: 'trns' }
  if (isNoOp(code)) return { kind: 'no' }

  const tmpl = code.template

  // Template-driven branches
  if (tmpl) {
    switch (tmpl.kind) {
      case 'LayerTap':
        return {
          kind: 'split',
          family: 'layer',
          hold: `L${tmpl.layer}`,
          tap: tapLabel(code, tmpl.tap_kc),
        }
      case 'ModTap':
        return {
          kind: 'split',
          family: 'modtap',
          hold: modName(tmpl.mod_mask),
          tap: tapLabel(code, tmpl.tap_kc),
        }
      case 'LayerOp': {
        const verb = LAYER_OP_VERB[tmpl.op] ?? tmpl.op
        return { kind: 'descriptor', family: 'layer', verb, payload: `L${tmpl.layer}` }
      }
      case 'OneShotMod':
        return {
          kind: 'descriptor',
          family: 'modtap',
          verb: 'one-shot',
          payload: modNameShort(tmpl.mod_mask),
        }
      case 'LayerMod':
        return {
          kind: 'descriptor',
          family: 'layermod',
          verb: 'layer+mod',
          payload: `L${tmpl.layer}`,
        }
      case 'Modified': {
        const output = code.label ?? code.key
        // Derive a readable corner from code.key (e.g. "S(KC_1)" -> "S(1)")
        // or fall back to modName if key string isn't parseable
        const corner = code.key.replace(/^(\w+)\(KC_(.+)\)$/, '$1($2)')
        return { kind: 'modified', output, corner }
      }
    }
  }

  // Group prefix (e.g. rgb, bl, media) — but NOT basic keys (KC_* keys carry group in real catalog)
  if (code.group && !code.key.startsWith('KC_')) {
    const payload = code.label ?? code.key
    return { kind: 'prefix', tag: code.group, payload }
  }

  // Basic key with a label
  if (code.label) {
    return code.top
      ? { kind: 'basic', label: code.label, top: code.top }
      : { kind: 'basic', label: code.label }
  }

  // Fallback: hex
  return { kind: 'hex', code: code.code ?? 0 }
}
