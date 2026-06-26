import { describe, it, expect } from 'vitest'
import { startFill, canTabFill, completeFill, shouldComplete } from './templateFill'
import type { EncoderTarget, KeyTarget } from './templateFill'

describe('templateFill', () => {
  it('startFill on LT opens a tap hole', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 1, column: 2 }, { kind: 'LT' }, { layer: 2 })!
    expect(p).toMatchObject({ kind: 'LT', hole: 'tap', fixed: { layer: 2 } })
  })

  it('only basic fills a tap hole', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 1, column: 2 }, { kind: 'LT' }, { layer: 2 })!
    expect(canTabFill(p, 'basic')).toBe(true)
    expect(canTabFill(p, 'layer')).toBe(false)
  })

  it('completeFill assembles LT(2, KC_SPC)', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 1, column: 2 }, { kind: 'LT' }, { layer: 2 })!
    const out = completeFill(p, { key: 'KC_SPC', label: 'Spc', code: 44 })
    expect(out).toMatchObject({
      key: 'LT(2,KC_SPC)',
      label: 'Spc',
      template: { kind: 'LayerTap', layer: 2, tap_kc: 44 },
    })
  })

  it('LM opens a mod hole filled from the mod grid', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 0, column: 0 }, { kind: 'LM' }, { layer: 1 })!
    expect(p.hole).toBe('mod')
    expect(canTabFill(p, 'modgrid')).toBe(true)
  })

  it('shouldComplete: LT pending + basic tab → true', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 0, column: 0 }, { kind: 'LT' }, { layer: 1 })!
    expect(shouldComplete(p, 'basic')).toBe(true)
  })

  it('shouldComplete: MT pending + basic tab → true', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 0, column: 0 }, { kind: 'MT', mods: [] }, { mod_mask: 2 })!
    expect(shouldComplete(p, 'basic')).toBe(true)
  })

  it('shouldComplete: LM pending + basic tab → false (mod hole, not fillable from basic)', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 0, column: 0 }, { kind: 'LM' }, { layer: 1 })!
    expect(shouldComplete(p, 'basic')).toBe(false)
  })

  it('shouldComplete: null pending → false', () => {
    expect(shouldComplete(null, 'basic')).toBe(false)
  })

  it('startFill on non-parameterized kind returns null', () => {
    expect(startFill({ kind: 'key', layer: 0, row: 0, column: 0 }, { kind: 'MO' }, {})).toBeNull()
    expect(startFill({ kind: 'key', layer: 0, row: 0, column: 0 }, { kind: 'TG' }, {})).toBeNull()
  })

  it('startFill on MT opens a tap hole', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 0, column: 3 }, { kind: 'MT', mods: ['MOD_LSFT'] }, { mod_mask: 2 })!
    expect(p).toMatchObject({ kind: 'MT', hole: 'tap', fixed: { mod_mask: 2 } })
  })

  it('canTabFill for mod hole: modgrid yes, basic no', () => {
    const p = startFill({ kind: 'key', layer: 0, row: 0, column: 0 }, { kind: 'LM' }, { layer: 1 })!
    expect(canTabFill(p, 'modgrid')).toBe(true)
    expect(canTabFill(p, 'basic')).toBe(false)
  })

  it('startFill carries an EncoderTarget through PendingFill.target unchanged', () => {
    const enc: EncoderTarget = { kind: 'encoder', layer: 0, encoder: 0, clockwise: 1 }
    const p = startFill(enc, { kind: 'LT' }, { layer: 2 })!
    expect(p.target).toEqual(enc)
    expect(p.target.kind).toBe('encoder')
    // KeyTarget fields are absent
    expect((p.target as KeyTarget | EncoderTarget).kind).toBe('encoder')
  })
})
