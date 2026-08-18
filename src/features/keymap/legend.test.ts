import { describe, it, expect } from 'vitest'
import { legendOf, modName } from './legend'

describe('legendOf', () => {
  it('KC_TRNS -> trns', () => expect(legendOf({ key: 'KC_TRNS' }).kind).toBe('trns'))
  // Real firmware decodes the transparent keycode to its canonical name with
  // KC_TRNS as an alias (and u16 0x0001); all must render as trns.
  it('KC_TRANSPARENT (real canonical name) -> trns', () =>
    expect(legendOf({ key: 'KC_TRANSPARENT', label: 'Transparent', code: 1, aliases: ['KC_TRNS'] }).kind).toBe('trns'))
  it('transparent by u16 0x0001 -> trns', () => expect(legendOf({ key: '0x0001', code: 0x0001 }).kind).toBe('trns'))
  it('KC_NO -> no', () => expect(legendOf({ key: 'KC_NO' }).kind).toBe('no'))
  it('no-op by u16 0x0000 -> no', () => expect(legendOf({ key: '0x0000', code: 0x0000 }).kind).toBe('no'))
  it('basic letter', () => expect(legendOf({ key: 'KC_A', label: 'A' })).toMatchObject({ kind: 'basic', label: 'A' }))
  it('LT split', () =>
    expect(legendOf({ key: 'LT(2,KC_SPC)', label: 'Spc', template: { kind: 'LayerTap', layer: 2, tap_kc: 0 } }))
      .toMatchObject({ kind: 'split', family: 'layer', hold: 'L2' }))
  it('MO descriptor', () =>
    expect(legendOf({ key: 'MO(1)', template: { kind: 'LayerOp', op: 'MO', layer: 1 } }))
      .toMatchObject({ kind: 'descriptor', family: 'layer', verb: 'momentary', payload: 'L1' }))
  it('rgb prefix', () =>
    expect(legendOf({ key: 'RGB_HUI', group: 'rgb', label: 'Hue+' }))
      .toMatchObject({ kind: 'prefix', tag: 'rgb', payload: 'Hue+' }))
  it('modified corner', () =>
    expect(legendOf({ key: 'S(KC_1)', label: '!', template: { kind: 'Modified', mod_mask: 2, base_kc: 30 } }))
      .toMatchObject({ kind: 'modified', output: '!' }))

  // --- new branches ---

  it('ModTap: kind=split, family=modtap, readable hold', () => {
    const result = legendOf({
      key: 'MT(MOD_LCTL,KC_S)',
      label: 'S',
      template: { kind: 'ModTap', mod_mask: 0x01, tap_kc: 0x16 },
    })
    expect(result).toMatchObject({ kind: 'split', family: 'modtap', tap: 'S' })
    if (result.kind === 'split') {
      expect(result.hold).toBe('Ctrl')
      expect(result.hold).not.toMatch(/^0x/)
    }
  })

  // Real firmware decodes MT/LT with `label` = the combined macro form
  // (e.g. "LCTL_T(S)") and `bottom` = the tap keycode label. The split cap's
  // tap zone must show the tap keycode, not the whole mod-tap keycode.
  it('ModTap from real firmware: tap zone uses `bottom`, not the combined label', () => {
    const result = legendOf({
      code: 0x2116,
      key: 'LCTL_T(S)',
      label: 'LCTL_T(S)',
      top: 'LCTL_T',
      bottom: 'S',
      group: 'mod_tap',
      template: { kind: 'ModTap', mod_mask: 0x01, tap_kc: 0x16 },
    })
    expect(result).toMatchObject({ kind: 'split', family: 'modtap', hold: 'Ctrl', tap: 'S' })
  })

  it('LayerTap from real firmware: tap zone uses `bottom`, not the combined label', () => {
    const result = legendOf({
      code: 0x4107,
      key: 'LT(1, D)',
      label: 'LT(1, D)',
      top: 'LT(1)',
      bottom: 'D',
      group: 'layer_tap',
      template: { kind: 'LayerTap', layer: 1, tap_kc: 0x07 },
    })
    expect(result).toMatchObject({ kind: 'split', family: 'layer', hold: 'L1', tap: 'D' })
  })

  it('OneShotMod: kind=descriptor, family=modtap, readable payload', () => {
    const result = legendOf({
      key: 'OSM(MOD_LSFT)',
      template: { kind: 'OneShotMod', mod_mask: 0x02 },
    })
    expect(result).toMatchObject({ kind: 'descriptor', family: 'modtap', verb: 'one-shot' })
    if (result.kind === 'descriptor') {
      expect(result.payload).toBe('Sft')
      expect(result.payload).not.toMatch(/^0x/)
    }
  })

  it('LayerMod: kind=descriptor, family=layermod', () => {
    const result = legendOf({
      key: 'LM(1,MOD_LSFT)',
      template: { kind: 'LayerMod', layer: 1, mod_mask: 0x02 },
    })
    expect(result).toMatchObject({ kind: 'descriptor', family: 'layermod', verb: 'layer+mod', payload: 'L1' })
  })

  it('I1: basic key with group renders as plain, not prefix', () => {
    // Real catalog populates group on basic keys (e.g. group:'basic'); must not fire prefix path
    const result = legendOf({ key: 'KC_A', label: 'A', group: 'basic', code: 0x04 })
    expect(result).toMatchObject({ kind: 'basic', label: 'A' })
    expect(result.kind).not.toBe('prefix')
  })

  it('basic: cap_label wins over label', () =>
    expect(legendOf({ key: 'KC_BACKSPACE', label: 'Backspace', cap_label: 'Back\nSpace' }))
      .toMatchObject({ kind: 'basic', label: 'Back\nSpace' }))

  it('basic: falls back to label when cap_label is absent', () =>
    expect(legendOf({ key: 'KC_A', label: 'A' }))
      .toMatchObject({ kind: 'basic', label: 'A' }))

  it('prefix: cap_label wins over label', () =>
    expect(legendOf({ key: 'BL_STEP', group: 'backlight', label: 'Backlight Step', cap_label: 'Back\nlight' }))
      .toMatchObject({ kind: 'prefix', tag: 'backlight', payload: 'Back\nlight' }))

})

describe('modName', () => {
  it('0x01 -> Ctrl', () => expect(modName(0x01)).toBe('Ctrl'))
  it('0x02 -> Shift', () => expect(modName(0x02)).toBe('Shift'))
  it('0x04 -> Alt', () => expect(modName(0x04)).toBe('Alt'))
  it('0x08 -> GUI', () => expect(modName(0x08)).toBe('GUI'))
  it('0x07 -> Meh', () => expect(modName(0x07)).toBe('Meh'))
  it('0x0F -> Hyper', () => expect(modName(0x0f)).toBe('Hyper'))
  it('0x10 -> RCtrl', () => expect(modName(0x10)).toBe('RCtrl'))
  it('right Meh 0x70 -> Meh', () => expect(modName(0x70)).toBe('Meh'))
  it('right Hyper 0xF0 -> Hyper', () => expect(modName(0xf0)).toBe('Hyper'))
})
