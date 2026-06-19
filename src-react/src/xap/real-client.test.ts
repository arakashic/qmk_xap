import { describe, it, expect, vi } from 'vitest'
import { RealXapClient } from './real-client'
import { unwrap } from './result'
import { ugoState, miniState, ugoKeymap } from './mock/fixtures'
import { ugoConstants } from './mock/constants'
import type { XapDeviceState, MappedKeymap, XapConstants } from './types'
import type { XapCommands } from './real-client'

// ---------------------------------------------------------------------------
// unwrap unit tests
// ---------------------------------------------------------------------------

describe('unwrap', () => {
  it('returns data on ok', () => {
    expect(unwrap({ status: 'ok', data: 42 })).toBe(42)
  })
  it('throws on error (string error)', () => {
    expect(() => unwrap({ status: 'error', error: 'something failed' })).toThrow('something failed')
  })
  it('throws on error (unknown error)', () => {
    expect(() => unwrap({ status: 'error', error: { code: 42 } })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Fake commands for injection
// ---------------------------------------------------------------------------

function makeFakeCommands(overrides?: Partial<XapCommands>): XapCommands {
  return {
    devicesGet: vi.fn().mockResolvedValue([ugoState, miniState]),
    deviceGet: vi.fn().mockResolvedValue({ status: 'ok', data: ugoState }),
    keymapGet: vi.fn().mockResolvedValue({ status: 'ok', data: ugoKeymap }),
    xapConstantsGet: vi.fn().mockResolvedValue(ugoConstants),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// RealXapClient query method tests
// ---------------------------------------------------------------------------

describe('RealXapClient queries', () => {
  it('listDevices returns DeviceSummary[] mapped from XapDeviceState[]', async () => {
    const client = new RealXapClient(makeFakeCommands())
    const devices = await client.listDevices()
    expect(devices).toHaveLength(2)
    expect(devices[0]).toEqual({
      id: ugoState.id,
      product: ugoState.info?.qmk.product_name ?? 'Unknown',
      manufacturer: ugoState.info?.qmk.manufacturer ?? '',
      secureStatus: ugoState.secure_status,
    })
    expect(devices[1]).toEqual({
      id: miniState.id,
      product: miniState.info?.qmk.product_name ?? 'Unknown',
      manufacturer: miniState.info?.qmk.manufacturer ?? '',
      secureStatus: miniState.secure_status,
    })
  })

  it('listDevices uses fallback product "Unknown" when info is null', async () => {
    const noInfoState: XapDeviceState = { ...ugoState, info: null }
    const client = new RealXapClient(
      makeFakeCommands({ devicesGet: vi.fn().mockResolvedValue([noInfoState]) }),
    )
    const [d] = await client.listDevices()
    expect(d.product).toBe('Unknown')
    expect(d.manufacturer).toBe('')
  })

  it('getDeviceState unwraps Result<XapDeviceState>', async () => {
    const client = new RealXapClient(makeFakeCommands())
    const state = await client.getDeviceState(ugoState.id)
    expect(state.id).toBe(ugoState.id)
  })

  it('getDeviceState throws when command returns error', async () => {
    const client = new RealXapClient(
      makeFakeCommands({ deviceGet: vi.fn().mockResolvedValue({ status: 'error', error: 'device not found' }) }),
    )
    await expect(client.getDeviceState('bad-id')).rejects.toThrow('device not found')
  })

  it('getMappedKeymap returns MappedKeymap using first layout from device config', async () => {
    const client = new RealXapClient(makeFakeCommands())
    const km = await client.getMappedKeymap(ugoState.id)
    expect(km.keys.length).toBeGreaterThan(0)
  })

  it('getMappedKeymap calls keymapGet with first layout key', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands)
    await client.getMappedKeymap(ugoState.id)
    // The first layout key in ugoState.config.layouts is 'LAYOUT_gen2'
    expect(fakeCommands.keymapGet).toHaveBeenCalledWith(ugoState.id, 'LAYOUT_gen2')
  })

  it('getMappedKeymap throws when keymapGet returns error', async () => {
    const client = new RealXapClient(
      makeFakeCommands({ keymapGet: vi.fn().mockResolvedValue({ status: 'error', error: 'keymap fetch failed' }) }),
    )
    await expect(client.getMappedKeymap(ugoState.id)).rejects.toThrow('keymap fetch failed')
  })

  it('getConstants returns XapConstants directly (no unwrap)', async () => {
    const client = new RealXapClient(makeFakeCommands())
    const constants = await client.getConstants()
    expect(constants.keycode_view.tabs.length).toBeGreaterThan(0)
    expect(constants.keycode_view.tabs.map((t) => t.id)).toEqual(
      ugoConstants.keycode_view.tabs.map((t) => t.id),
    )
  })
})
