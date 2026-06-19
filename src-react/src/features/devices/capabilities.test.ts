import { describe, it, expect } from 'vitest'
import { capabilitiesOf, hardwareStatsOf } from './capabilities'
import { ugoState, miniState } from '@/xap/mock/fixtures'

describe('capabilitiesOf', () => {
  it('marks Keymap present when info.keymap is non-null', () => {
    const caps = capabilitiesOf(ugoState)
    const keymap = caps.find((c) => c.label === 'Keymap')
    expect(keymap?.present).toBe(true)
  })

  it('marks Lighting absent when info.lighting is null', () => {
    const caps = capabilitiesOf(ugoState)
    const lighting = caps.find((c) => c.label === 'Lighting')
    expect(lighting?.present).toBe(false)
  })

  it('marks Encoders present when encoder_count > 0', () => {
    const caps = capabilitiesOf(ugoState)
    const encoders = caps.find((c) => c.label === 'Encoders')
    expect(encoders?.present).toBe(true)
  })

  it('marks Encoders absent when encoder_count is 0', () => {
    const caps = capabilitiesOf(miniState)
    const encoders = caps.find((c) => c.label === 'Encoders')
    expect(encoders?.present).toBe(false)
  })

  it('marks Remap absent when info.remap is null', () => {
    const caps = capabilitiesOf(ugoState)
    const remap = caps.find((c) => c.label === 'Remap')
    expect(remap?.present).toBe(false)
  })
})

describe('hardwareStatsOf', () => {
  it('returns Layers = "8" for ugoState', () => {
    const stats = hardwareStatsOf(ugoState)
    const layers = stats.find((s) => s.label === 'Layers')
    expect(layers?.value).toBe('8')
  })

  it('returns Matrix = "16×7" for ugoState', () => {
    const stats = hardwareStatsOf(ugoState)
    const matrix = stats.find((s) => s.label === 'Matrix')
    expect(matrix?.value).toBe('16×7')
  })

  it('returns Encoders = "3" for ugoState', () => {
    const stats = hardwareStatsOf(ugoState)
    const encoders = stats.find((s) => s.label === 'Encoders')
    expect(encoders?.value).toBe('3')
  })

  it('returns Layers = "4" for miniState', () => {
    const stats = hardwareStatsOf(miniState)
    const layers = stats.find((s) => s.label === 'Layers')
    expect(layers?.value).toBe('4')
  })
})
