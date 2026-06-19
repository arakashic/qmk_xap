import { describe, it, expect } from 'vitest'
import { legendOf } from './legend'

describe('legendOf', () => {
  it('KC_TRNS -> trns', () => expect(legendOf({ key: 'KC_TRNS' }).kind).toBe('trns'))
  it('KC_NO -> no', () => expect(legendOf({ key: 'KC_NO' }).kind).toBe('no'))
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
})
