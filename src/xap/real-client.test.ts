import { describe, it, expect, vi } from 'vitest'
import { RealXapClient } from './real-client'
import { unwrap } from './result'
import { ugoState, miniState, ugoKeymap, ugoLighting } from './mock/fixtures'
import { ugoConstants } from './mock/constants'
import type { XapDeviceState, MappedKeymap, XapConstants, KeyCode, XapEvent, BacklightConfig, RgbLightConfig, RgbMatrixConfig } from './types'
import type { XapCommands, XapEventSource } from './real-client'
import type { Unsubscribe } from './client'

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
    xapSecureLock: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    xapSecureUnlock: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    qmkJumpToBootloader: vi.fn().mockResolvedValue({ status: 'ok', data: 0 }),
    qmkReinitializeEeprom: vi.fn().mockResolvedValue({ status: 'ok', data: 0 }),
    backlightGetConfig: vi.fn().mockResolvedValue({ status: 'ok', data: ugoLighting.backlight }),
    backlightSetConfig: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    backlightSaveConfig: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    rgblightGetConfig: vi.fn().mockResolvedValue({ status: 'ok', data: ugoLighting.rgblight }),
    rgblightSetConfig: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    rgblightSaveConfig: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    rgbmatrixGetConfig: vi.fn().mockResolvedValue({ status: 'ok', data: ugoLighting.rgbmatrix }),
    rgbmatrixSetConfig: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    rgbmatrixSaveConfig: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    ...overrides,
  }
}

// A fake event source that lets tests push events to registered handlers.
function makeFakeEvents(): XapEventSource & { push(e: XapEvent): void } {
  const handlers: Array<(e: XapEvent) => void> = []
  return {
    on(handler) {
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i !== -1) handlers.splice(i, 1)
      }
    },
    push(e) {
      for (const h of handlers) h(e)
    },
  }
}

// Silent event source for tests that don't need events.
const silentEvents: XapEventSource = { on: () => () => {} }

// ---------------------------------------------------------------------------
// RealXapClient query method tests
// ---------------------------------------------------------------------------

describe('RealXapClient queries', () => {
  it('listDevices returns DeviceSummary[] mapped from XapDeviceState[]', async () => {
    const client = new RealXapClient(makeFakeCommands(), silentEvents)
    const devices = await client.listDevices()
    expect(devices).toHaveLength(2)
    expect(devices[0]).toEqual({
      id: ugoState.id,
      product: ugoState.info?.qmk.product_name ?? 'Unknown',
      manufacturer: ugoState.info?.qmk.manufacturer ?? '',
      secureStatus: ugoState.secure_status,
      status: 'ready',
    })
    expect(devices[1]).toEqual({
      id: miniState.id,
      product: miniState.info?.qmk.product_name ?? 'Unknown',
      manufacturer: miniState.info?.qmk.manufacturer ?? '',
      secureStatus: miniState.secure_status,
      status: 'ready',
    })
  })

  it('listDevices uses fallback product "Unknown" when info is null', async () => {
    const noInfoState: XapDeviceState = { ...ugoState, info: null }
    const client = new RealXapClient(
      makeFakeCommands({ devicesGet: vi.fn().mockResolvedValue([noInfoState]) }),
      silentEvents,
    )
    const [d] = await client.listDevices()
    expect(d.product).toBe('Unknown')
    expect(d.manufacturer).toBe('')
  })

  it('getDeviceState unwraps Result<XapDeviceState>', async () => {
    const client = new RealXapClient(makeFakeCommands(), silentEvents)
    const state = await client.getDeviceState(ugoState.id)
    expect(state.id).toBe(ugoState.id)
  })

  it('getDeviceState throws when command returns error', async () => {
    const client = new RealXapClient(
      makeFakeCommands({ deviceGet: vi.fn().mockResolvedValue({ status: 'error', error: 'device not found' }) }),
      silentEvents,
    )
    await expect(client.getDeviceState('bad-id')).rejects.toThrow('device not found')
  })

  it('getMappedKeymap returns MappedKeymap using first layout from device config', async () => {
    const client = new RealXapClient(makeFakeCommands(), silentEvents)
    const km = await client.getMappedKeymap(ugoState.id)
    expect(km.keys.length).toBeGreaterThan(0)
  })

  it('getMappedKeymap calls keymapGet with first layout key', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await client.getMappedKeymap(ugoState.id)
    // The first layout key in ugoState.config.layouts is 'LAYOUT_gen2'
    expect(fakeCommands.keymapGet).toHaveBeenCalledWith(ugoState.id, 'LAYOUT_gen2')
  })

  it('getMappedKeymap throws when keymapGet returns error', async () => {
    const client = new RealXapClient(
      makeFakeCommands({ keymapGet: vi.fn().mockResolvedValue({ status: 'error', error: 'keymap fetch failed' }) }),
      silentEvents,
    )
    await expect(client.getMappedKeymap(ugoState.id)).rejects.toThrow('keymap fetch failed')
  })

  it('getConstants returns XapConstants directly (no unwrap)', async () => {
    const client = new RealXapClient(makeFakeCommands(), silentEvents)
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
    const client = new RealXapClient(fakeCommands, silentEvents)
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
    const client = new RealXapClient(fakeCommands, silentEvents)
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
    const client = new RealXapClient(fakeCommands, silentEvents)
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
    const client = new RealXapClient(fakeCommands, silentEvents)
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
    const client = new RealXapClient(fakeCommands, silentEvents)
    const code: KeyCode = { key: 'LT(0,KC_A)', template: { kind: 'LayerTap', layer: 0, tap_kc: 0x04 } }
    await expect(client.remapKey('dev1', { layer: 0, row: 0, column: 0 }, code)).rejects.toThrow('bad template')
    expect(fakeCommands.remapKey).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Task 3: lifecycle methods + subscribe
// ---------------------------------------------------------------------------

describe('RealXapClient lifecycle', () => {
  it('(a) secureLock calls xapSecureLock and returns void', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.secureLock('dev1')).resolves.toBeUndefined()
    expect(fakeCommands.xapSecureLock).toHaveBeenCalledWith('dev1')
  })

  it('(a) secureLock throws when command returns error', async () => {
    const fakeCommands = makeFakeCommands({
      xapSecureLock: vi.fn().mockResolvedValue({ status: 'error', error: 'lock failed' }),
    })
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.secureLock('dev1')).rejects.toThrow('lock failed')
  })

  it('(a) secureUnlock calls xapSecureUnlock and returns void', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.secureUnlock('dev1')).resolves.toBeUndefined()
    expect(fakeCommands.xapSecureUnlock).toHaveBeenCalledWith('dev1')
  })

  it('(a) secureUnlock throws when command returns error', async () => {
    const fakeCommands = makeFakeCommands({
      xapSecureUnlock: vi.fn().mockResolvedValue({ status: 'error', error: 'unlock failed' }),
    })
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.secureUnlock('dev1')).rejects.toThrow('unlock failed')
  })

  it('(a) jumpToBootloader calls qmkJumpToBootloader and returns void', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.jumpToBootloader('dev1')).resolves.toBeUndefined()
    expect(fakeCommands.qmkJumpToBootloader).toHaveBeenCalledWith('dev1')
  })

  it('(a) jumpToBootloader throws when command returns error', async () => {
    const fakeCommands = makeFakeCommands({
      qmkJumpToBootloader: vi.fn().mockResolvedValue({ status: 'error', error: 'bootloader failed' }),
    })
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.jumpToBootloader('dev1')).rejects.toThrow('bootloader failed')
  })

  it('(a) reinitializeEeprom calls qmkReinitializeEeprom and returns void', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.reinitializeEeprom('dev1')).resolves.toBeUndefined()
    expect(fakeCommands.qmkReinitializeEeprom).toHaveBeenCalledWith('dev1')
  })

  it('(a) reinitializeEeprom throws when command returns error', async () => {
    const fakeCommands = makeFakeCommands({
      qmkReinitializeEeprom: vi.fn().mockResolvedValue({ status: 'error', error: 'eeprom failed' }),
    })
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.reinitializeEeprom('dev1')).rejects.toThrow('eeprom failed')
  })

  it('(c) secureLock does NOT emit events to subscribers', async () => {
    const fakeEvents = makeFakeEvents()
    const client = new RealXapClient(makeFakeCommands(), fakeEvents)
    const handler = vi.fn()
    client.subscribe(handler)
    await client.secureLock('dev1')
    expect(handler).not.toHaveBeenCalled()
  })

  it('(c) secureUnlock does NOT emit events to subscribers', async () => {
    const fakeEvents = makeFakeEvents()
    const client = new RealXapClient(makeFakeCommands(), fakeEvents)
    const handler = vi.fn()
    client.subscribe(handler)
    await client.secureUnlock('dev1')
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('RealXapClient subscribe', () => {
  it('(b) pushing a SecureStatusChanged event delivers it to the registered handler', () => {
    const fakeEvents = makeFakeEvents()
    const client = new RealXapClient(makeFakeCommands(), fakeEvents)
    const handler = vi.fn()
    client.subscribe(handler)
    const event: XapEvent = { kind: 'SecureStatusChanged', data: { id: 'dev1', secure_status: 'Locked' } }
    fakeEvents.push(event)
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('(b) the returned Unsubscribe stops further event delivery', () => {
    const fakeEvents = makeFakeEvents()
    const client = new RealXapClient(makeFakeCommands(), fakeEvents)
    const handler = vi.fn()
    const unsub = client.subscribe(handler)
    const event: XapEvent = { kind: 'SecureStatusChanged', data: { id: 'dev1', secure_status: 'Unlocked' } }
    fakeEvents.push(event)
    expect(handler).toHaveBeenCalledOnce()
    unsub()
    fakeEvents.push(event)
    expect(handler).toHaveBeenCalledOnce() // still only once
  })

  it('(b) multiple handlers can subscribe independently', () => {
    const fakeEvents = makeFakeEvents()
    const client = new RealXapClient(makeFakeCommands(), fakeEvents)
    const h1 = vi.fn()
    const h2 = vi.fn()
    client.subscribe(h1)
    const unsub2 = client.subscribe(h2)
    const event: XapEvent = { kind: 'NewDevice', data: { id: 'dev2' } }
    fakeEvents.push(event)
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
    unsub2()
    fakeEvents.push(event)
    expect(h1).toHaveBeenCalledTimes(2)
    expect(h2).toHaveBeenCalledOnce() // unsubscribed
  })
})

// ---------------------------------------------------------------------------
// Task 7: lighting get/set/save
// ---------------------------------------------------------------------------

describe('RealXapClient lighting', () => {
  it('getLightingConfig(id, "rgbmatrix") returns RgbMatrixConfig', async () => {
    const client = new RealXapClient(makeFakeCommands(), silentEvents)
    const cfg = await client.getLightingConfig('dev1', 'rgbmatrix') as RgbMatrixConfig
    expect(cfg).toEqual(ugoLighting.rgbmatrix)
  })

  it('getLightingConfig(id, "rgblight") returns RgbLightConfig', async () => {
    const client = new RealXapClient(makeFakeCommands(), silentEvents)
    const cfg = await client.getLightingConfig('dev1', 'rgblight') as RgbLightConfig
    expect(cfg).toEqual(ugoLighting.rgblight)
  })

  it('getLightingConfig(id, "backlight") returns BacklightConfig', async () => {
    const client = new RealXapClient(makeFakeCommands(), silentEvents)
    const cfg = await client.getLightingConfig('dev1', 'backlight') as BacklightConfig
    expect(cfg).toEqual(ugoLighting.backlight)
  })

  it('setLightingConfig(id, "rgblight", cfg) calls rgblightSetConfig with cfg', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    const cfg = ugoLighting.rgblight as RgbLightConfig
    await client.setLightingConfig('dev1', 'rgblight', cfg)
    expect(fakeCommands.rgblightSetConfig).toHaveBeenCalledWith('dev1', cfg)
  })

  it('setLightingConfig(id, "rgbmatrix", cfg) calls rgbmatrixSetConfig with cfg', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    const cfg = ugoLighting.rgbmatrix as RgbMatrixConfig
    await client.setLightingConfig('dev1', 'rgbmatrix', cfg)
    expect(fakeCommands.rgbmatrixSetConfig).toHaveBeenCalledWith('dev1', cfg)
  })

  it('setLightingConfig(id, "backlight", cfg) calls backlightSetConfig with cfg', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    const cfg = ugoLighting.backlight as BacklightConfig
    await client.setLightingConfig('dev1', 'backlight', cfg)
    expect(fakeCommands.backlightSetConfig).toHaveBeenCalledWith('dev1', cfg)
  })

  it('saveLightingConfig(id, "backlight") calls backlightSaveConfig', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await client.saveLightingConfig('dev1', 'backlight')
    expect(fakeCommands.backlightSaveConfig).toHaveBeenCalledWith('dev1')
  })

  it('saveLightingConfig(id, "rgblight") calls rgblightSaveConfig', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await client.saveLightingConfig('dev1', 'rgblight')
    expect(fakeCommands.rgblightSaveConfig).toHaveBeenCalledWith('dev1')
  })

  it('saveLightingConfig(id, "rgbmatrix") calls rgbmatrixSaveConfig', async () => {
    const fakeCommands = makeFakeCommands()
    const client = new RealXapClient(fakeCommands, silentEvents)
    await client.saveLightingConfig('dev1', 'rgbmatrix')
    expect(fakeCommands.rgbmatrixSaveConfig).toHaveBeenCalledWith('dev1')
  })

  it('getLightingConfig error result propagates as throw', async () => {
    const fakeCommands = makeFakeCommands({
      rgbmatrixGetConfig: vi.fn().mockResolvedValue({ status: 'error', error: 'lighting unavailable' }),
    })
    const client = new RealXapClient(fakeCommands, silentEvents)
    await expect(client.getLightingConfig('dev1', 'rgbmatrix')).rejects.toThrow('lighting unavailable')
  })
})
