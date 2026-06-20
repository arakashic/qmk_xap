import { describe, it, expect } from 'vitest'
import { qmkToHsb, hsbToQmk, effectOptions, effectLabel, subsystemMeta } from './lightingModel'
import type { LightingEffect } from '@/xap/types'

describe('qmkToHsb', () => {
  it('converts (0,255,255) to {hue:0, saturation:100, brightness:100}', () => {
    expect(qmkToHsb(0, 255, 255)).toEqual({ hue: 0, saturation: 100, brightness: 100 })
  })

  it('converts hue=255 to hue=360', () => {
    const result = qmkToHsb(255, 0, 0)
    expect(result.hue).toBe(360)
  })

  it('converts (128,128,128) using Math.round formula', () => {
    const result = qmkToHsb(128, 128, 128)
    expect(result.hue).toBe(Math.round(128 / 255 * 360))
    expect(result.saturation).toBe(Math.round(128 / 255 * 100))
    expect(result.brightness).toBe(Math.round(128 / 255 * 100))
  })
})

describe('hsbToQmk', () => {
  it('converts (0,100,100) to {hue:0, sat:255, val:255}', () => {
    expect(hsbToQmk(0, 100, 100)).toEqual({ hue: 0, sat: 255, val: 255 })
  })

  it('converts (360,100,100) to max 255 each (clamped)', () => {
    const result = hsbToQmk(360, 100, 100)
    expect(result.hue).toBeLessThanOrEqual(255)
    expect(result.sat).toBeLessThanOrEqual(255)
    expect(result.val).toBeLessThanOrEqual(255)
  })

  it('round-trip: hsbToQmk(qmkToHsb(140, 255, 200)) within ±1 of original', () => {
    const hsb = qmkToHsb(140, 255, 200)
    const result = hsbToQmk(hsb.hue, hsb.saturation, hsb.brightness)
    expect(Math.abs(result.hue - 140)).toBeLessThanOrEqual(1)
    expect(Math.abs(result.sat - 255)).toBeLessThanOrEqual(1)
    expect(Math.abs(result.val - 200)).toBeLessThanOrEqual(1)
  })

  it('round-trip: hsbToQmk(qmkToHsb(0, 0, 0)) equals (0,0,0)', () => {
    const hsb = qmkToHsb(0, 0, 0)
    expect(hsbToQmk(hsb.hue, hsb.saturation, hsb.brightness)).toEqual({ hue: 0, sat: 0, val: 0 })
  })

  it('round-trip: hsbToQmk(qmkToHsb(255, 255, 255)) within ±1', () => {
    const hsb = qmkToHsb(255, 255, 255)
    const result = hsbToQmk(hsb.hue, hsb.saturation, hsb.brightness)
    expect(Math.abs(result.hue - 255)).toBeLessThanOrEqual(1)
    expect(Math.abs(result.sat - 255)).toBeLessThanOrEqual(1)
    expect(Math.abs(result.val - 255)).toBeLessThanOrEqual(1)
  })
})

describe('effectOptions', () => {
  it('maps effects to {value, label} using code and label', () => {
    const effects: LightingEffect[] = [
      { code: 1, key: 'SOLID_COLOR', group: null, label: 'Solid Color' },
      { code: 2, key: 'BREATHING', group: null, label: 'Breathing' },
    ]
    expect(effectOptions(effects)).toEqual([
      { value: 1, label: 'Solid Color' },
      { value: 2, label: 'Breathing' },
    ])
  })

  it('falls back to key when label is absent', () => {
    const effects: LightingEffect[] = [
      { code: 5, key: 'CYCLE_LEFT_RIGHT', group: null },
    ]
    expect(effectOptions(effects)).toEqual([{ value: 5, label: 'CYCLE_LEFT_RIGHT' }])
  })

  it('defaults code to 0 when code is undefined', () => {
    const effects: LightingEffect[] = [
      { key: 'UNKNOWN_EFFECT', group: null },
    ]
    expect(effectOptions(effects)).toEqual([{ value: 0, label: 'UNKNOWN_EFFECT' }])
  })
})

describe('effectLabel', () => {
  const effects: LightingEffect[] = [
    { code: 1, key: 'SOLID_COLOR', group: null, label: 'Solid Color' },
    { code: 2, key: 'BREATHING', group: null, label: 'Breathing' },
  ]

  it('returns the label for a known mode', () => {
    expect(effectLabel(effects, 1)).toBe('Solid Color')
    expect(effectLabel(effects, 2)).toBe('Breathing')
  })

  it('returns "Mode N" for an unknown mode', () => {
    expect(effectLabel(effects, 99)).toBe('Mode 99')
  })

  it('returns "Mode 0" for mode 0 when not in list', () => {
    expect(effectLabel(effects, 0)).toBe('Mode 0')
  })
})

describe('subsystemMeta', () => {
  it('rgbmatrix: hasColor=true, hasSpeed=true, hasBrightness=false', () => {
    const meta = subsystemMeta('rgbmatrix')
    expect(meta.title).toBe('Per-key RGB')
    expect(meta.subtitle).toBe('rgb matrix')
    expect(meta.hasColor).toBe(true)
    expect(meta.hasSpeed).toBe(true)
    expect(meta.hasBrightness).toBe(false)
  })

  it('rgblight: hasColor=true, hasSpeed=true, hasBrightness=false', () => {
    const meta = subsystemMeta('rgblight')
    expect(meta.title).toBe('Underglow')
    expect(meta.subtitle).toBe('rgblight')
    expect(meta.hasColor).toBe(true)
    expect(meta.hasSpeed).toBe(true)
    expect(meta.hasBrightness).toBe(false)
  })

  it('backlight: hasColor=false, hasSpeed=false, hasBrightness=true', () => {
    const meta = subsystemMeta('backlight')
    expect(meta.title).toBe('Backlight')
    expect(meta.subtitle).toBe('backlight')
    expect(meta.hasColor).toBe(false)
    expect(meta.hasSpeed).toBe(false)
    expect(meta.hasBrightness).toBe(true)
  })
})
