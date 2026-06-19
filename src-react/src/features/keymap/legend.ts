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

export function legendOf(code: KeyCode): LegendModel {
  // Special transparent / no-op keys
  if (code.key === 'KC_TRNS') return { kind: 'trns' }
  if (code.key === 'KC_NO') return { kind: 'no' }

  const tmpl = code.template

  // Template-driven branches
  if (tmpl) {
    switch (tmpl.kind) {
      case 'LayerTap':
        return {
          kind: 'split',
          family: 'layer',
          hold: `L${tmpl.layer}`,
          tap: code.label ?? String(tmpl.tap_kc ?? '?'),
        }
      case 'ModTap':
        return {
          kind: 'split',
          family: 'modtap',
          hold: `0x${tmpl.mod_mask.toString(16).toUpperCase()}`,
          tap: code.label ?? String(tmpl.tap_kc ?? '?'),
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
          payload: `0x${tmpl.mod_mask.toString(16).toUpperCase()}`,
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
        return { kind: 'modified', output, corner: `0x${tmpl.mod_mask.toString(16).toUpperCase()}` }
      }
    }
  }

  // Group prefix (e.g. rgb, bl, media)
  if (code.group) {
    const payload = code.label ?? code.key
    return { kind: 'prefix', tag: code.group, payload }
  }

  // Basic key with a label
  if (code.label) {
    const result: LegendModel = { kind: 'basic', label: code.label }
    if (code.top) return { ...result, top: code.top }
    return result
  }

  // Fallback: hex
  return { kind: 'hex', code: code.code ?? 0 }
}
