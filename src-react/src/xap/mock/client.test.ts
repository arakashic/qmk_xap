import { describe, it, expect } from 'vitest'
import { MockXapClient } from './client'
import { ugoState } from './fixtures'
import { ugoConstants } from './constants'
import { ugoEncoders } from './encoders'

describe('MockXapClient', () => {
  it('lists the seeded device', async () => {
    const c = new MockXapClient()
    const ds = await c.listDevices()
    expect(ds.map((d) => d.id)).toContain(ugoState.id)
  })
  it('returns a mapped keymap with at least one layer of positioned keys', async () => {
    const c = new MockXapClient()
    const [d] = await c.listDevices()
    const km = await c.getMappedKeymap(d.id)
    expect(km.keys.length).toBeGreaterThan(0)         // layers
    expect(km.keys[0].flat().filter(Boolean).length).toBeGreaterThan(0) // keys on layer 0
  })
  it('rejects unknown device ids', async () => {
    const c = new MockXapClient()
    await expect(c.getDeviceState('nope')).rejects.toThrow()
  })
  it('getConstants returns the keycode view tabs', async () => {
    const c = new MockXapClient()
    const k = await c.getConstants()
    expect(k.keycode_view.tabs.map((t) => t.id)).toEqual(ugoConstants.keycode_view.tabs.map((t) => t.id))
    expect(k.keycode_view.tabs.length).toBeGreaterThan(0)
  })
  it('getEncoderKeymap returns 3 encoders with ccw/cw per layer', async () => {
    const c = new MockXapClient(); const [d] = await c.listDevices()
    const ek = await c.getEncoderKeymap(d.id)
    expect(ek[0].length).toBe(3)                 // layer 0 has 3 encoders
    expect(ek[0][0]).toHaveProperty('ccw'); expect(ek[0][0]).toHaveProperty('cw')
  })
  it('setEncoderKeycode updates the CW slot of encoder 0 on layer 0', async () => {
    const c = new MockXapClient(); const [d] = await c.listDevices()
    await c.setEncoderKeycode(d.id, { layer: 0, encoder: 0, clockwise: 1 }, { key: 'KC_MUTE', label: 'Mute' })
    const ek = await c.getEncoderKeymap(d.id)
    expect(ek[0][0].cw.key).toBe('KC_MUTE')
  })
  it('remapKey updates the mapped keymap at the target position', async () => {
    const c = new MockXapClient()
    const [d] = await c.listDevices()
    const newCode = { key: 'KC_Z', label: 'Z' }
    // pick an existing key's matrix position from the fixture (layer 0)
    const km0 = await c.getMappedKeymap(d.id)
    const first = km0.keys[0].flat().find(Boolean)!
    const row = Number(first.layout.matrix.y), column = Number(first.layout.matrix.x)
    await c.remapKey(d.id, { layer: 0, row, column }, newCode)
    const km1 = await c.getMappedKeymap(d.id)
    const updated = km1.keys[0].flat().find((k) => k && Number(k.layout.matrix.y) === row && Number(k.layout.matrix.x) === column)!
    expect(updated.key.code.key).toBe('KC_Z')
  })
})
