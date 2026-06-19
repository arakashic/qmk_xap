import { describe, it, expect, vi } from 'vitest'
import { RealXapClient } from './real-client'
import { unwrap } from './result'
import { ugoState, miniState, ugoKeymap } from './mock/fixtures'
import { ugoConstants } from './mock/constants'
import type { XapDeviceState, MappedKeymap, XapConstants, KeyCode } from './types'
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
    remapKey: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    keycodeTemplateEncode: vi.fn().mockResolvedValue({ status: 'ok', data: 0x4123 }),
    remappingSetEncoderKeycode: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    encoderKeymapGet: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
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

// ---------------------------------------------------------------------------
// Task 2: remapKey / setEncoderKeycode / getEncoderKeymap
// ---------------------------------------------------------------------------

describe('RealXapClient mutations', () => {
  it('(a) remapKey with basic KeyCode uses code directly, no keycodeTemplateEncode call', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands)
    const code: KeyCode = { key: 'KC_A', code: 0x04 }
    await client.remapKey('dev1', { layer: 0, row: 1, column: 2 }, code)
    expect(fakeCommands.keycodeTemplateEncode).not.toHaveBeenCalled()
    expect(fakeCommands.remapKey).toHaveBeenCalledWith('dev1', {
      layer: 0,
      row: 1,
      column: 2,
      keycode: 0x04,
    })
  })

  it('(b) remapKey with template KeyCode calls keycodeTemplateEncode then remapKey with encoded u16', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands)
    const template = { kind: 'LayerTap' as const, layer: 1, tap_kc: 0x04 }
    const code: KeyCode = { key: 'LT(1,KC_A)', template }
    await client.remapKey('dev1', { layer: 0, row: 1, column: 2 }, code)
    expect(fakeCommands.keycodeTemplateEncode).toHaveBeenCalledWith(template)
    expect(fakeCommands.remapKey).toHaveBeenCalledWith('dev1', {
      layer: 0,
      row: 1,
      column: 2,
      keycode: 0x4123,
    })
  })

  it('(c) setEncoderKeycode with template calls keycodeTemplateEncode then remappingSetEncoderKeycode', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands)
    const template = { kind: 'LayerTap' as const, layer: 2, tap_kc: null }
    const code: KeyCode = { key: 'LT(2)', template }
    await client.setEncoderKeycode('dev1', { layer: 0, encoder: 1, clockwise: 1 }, code)
    expect(fakeCommands.keycodeTemplateEncode).toHaveBeenCalledWith(template)
    expect(fakeCommands.remappingSetEncoderKeycode).toHaveBeenCalledWith('dev1', {
      layer: 0,
      encoder: 1,
      clockwise: 1,
      keycode: 0x4123,
    })
  })

  it('(d) getEncoderKeymap maps [layer][encoder][dir] tensor to {ccw, cw}[][]', async () => {
    const kcA: KeyCode = { key: 'KC_A', code: 0x04 }
    const kcB: KeyCode = { key: 'KC_B', code: 0x05 }
    const kcC: KeyCode = { key: 'KC_C', code: 0x06 }
    const kcD: KeyCode = { key: 'KC_D', code: 0x07 }
    // tensor: [layer][encoder][dir]  -> 1 layer, 2 encoders, dir[0]=ccw dir[1]=cw
    const tensor: KeyCode[][][] = [[[kcA, kcB], [kcC, kcD]]]
    const fakeCommands = makeFakeCommands({
      encoderKeymapGet: vi.fn().mockResolvedValue({ status: 'ok', data: tensor }),
    })
    const client = new RealXapClient(fakeCommands)
    const km = await client.getEncoderKeymap('dev1')
    expect(km).toHaveLength(1)          // 1 layer
    expect(km[0]).toHaveLength(2)       // 2 encoders
    expect(km[0][0]).toEqual({ ccw: kcA, cw: kcB })
    expect(km[0][1]).toEqual({ ccw: kcC, cw: kcD })
  })

  it('(e) encode failure from keycodeTemplateEncode propagates as throw', async () => {
    const fakeCommands = makeFakeCommands({
      keycodeTemplateEncode: vi.fn().mockResolvedValue({ status: 'error', error: 'bad template' }),
    })
    const client = new RealXapClient(fakeCommands)
    const code: KeyCode = { key: 'LT(0,KC_A)', template: { kind: 'LayerTap', layer: 0, tap_kc: 0x04 } }
    await expect(client.remapKey('dev1', { layer: 0, row: 0, column: 0 }, code)).rejects.toThrow('bad template')
  })
})
