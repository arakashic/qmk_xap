import { describe, it, expect } from 'vitest'
import { MockXapClient } from './client'
import { ugoState } from './fixtures'

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
})
