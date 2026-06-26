import type { KeyCode, SubgroupTemplate } from '@gen/xap-types'

export type KeyTarget = { kind: 'key'; layer: number; row: number; column: number }
export type EncoderTarget = { kind: 'encoder'; layer: number; encoder: number; clockwise: number }
export type PickerTarget = KeyTarget | EncoderTarget


export type PendingFill = {
  target: PickerTarget
  kind: 'LT' | 'MT' | 'LM'
  fixed: { layer?: number; mod_mask?: number }
  hole: 'tap' | 'mod'
}

/** Start a two-step fill. Returns null for one-step templates (MO, TG, etc.). */
export function startFill(
  target: PickerTarget,
  t: SubgroupTemplate,
  fixedChoice: { layer?: number; mod_mask?: number },
): PendingFill | null {
  if (t.kind === 'LT') {
    return { target, kind: 'LT', fixed: { layer: fixedChoice.layer }, hole: 'tap' }
  }
  if (t.kind === 'MT') {
    return { target, kind: 'MT', fixed: { mod_mask: fixedChoice.mod_mask }, hole: 'tap' }
  }
  if (t.kind === 'LM') {
    return { target, kind: 'LM', fixed: { layer: fixedChoice.layer }, hole: 'mod' }
  }
  return null
}

/** Which picker tabs can fill the current hole. */
export function canTabFill(p: PendingFill, tabId: string): boolean {
  if (p.hole === 'tap') return tabId === 'basic'
  if (p.hole === 'mod') return tabId === 'modgrid'
  return false
}

/** True only when the active tab can fill the current hole of the pending fill. */
export function shouldComplete(pending: PendingFill | null, activeTab: string): boolean {
  return !!pending && canTabFill(pending, activeTab)
}

/** Assemble the final KeyCode from the pending fill + the chosen key/mod. */
export function completeFill(p: PendingFill, chosen: KeyCode): KeyCode {
  if (p.kind === 'LT') {
    const layer = p.fixed.layer!
    const tapKey = chosen.key
    return {
      key: `LT(${layer},${tapKey})`,
      label: chosen.label,
      template: { kind: 'LayerTap', layer, tap_kc: chosen.code ?? null },
    }
  }
  if (p.kind === 'MT') {
    const modMask = p.fixed.mod_mask!
    const tapKey = chosen.key
    // Key string uses the mod name; since we only have the numeric mask here,
    // build the generic form. The real adapter (Plan 6) resolves the name.
    return {
      key: `MT(${modMask},${tapKey})`,
      label: chosen.label,
      template: { kind: 'ModTap', mod_mask: modMask, tap_kc: chosen.code ?? null },
    }
  }
  // LM: chosen is a mod key
  const layer = p.fixed.layer!
  const modKey = chosen.key
  return {
    key: `LM(${layer},${modKey})`,
    label: chosen.label,
    template: { kind: 'LayerMod', layer, mod_mask: chosen.code ?? null },
  }
}
