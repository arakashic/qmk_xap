import type { XapClient, DeviceSummary, Unsubscribe, EncoderKeymap, LightingSub, LightingConfig } from '../client'
import type { XapDeviceState, MappedKeymap, XapEvent, XapConstants, KeyCode } from '../types'
import { ugoState, ugoKeymap, miniState, ugoLighting } from './fixtures'
import { ugoConstants } from './constants'
import { ugoEncoders } from './encoders'

type Entry = { state: XapDeviceState; keymap: MappedKeymap; encoders: EncoderKeymap; lighting: Record<LightingSub, LightingConfig> }

export class MockXapClient implements XapClient {
  private devices: Map<string, Entry>
  private handlers: Set<(e: XapEvent) => void> = new Set()

  private emit(e: XapEvent): void {
    for (const h of this.handlers) h(e)
  }

  constructor() {
    // Deep-clone fixtures so mutations don't affect shared fixture objects.
    // bigint-safe replacer/reviver needed for state (matrix_size) and keymap.
    const bigintReplacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? `__bigint__${v}` : v)
    const bigintReviver = (_k: string, v: unknown) =>
      typeof v === 'string' && v.startsWith('__bigint__') ? BigInt(v.slice(10)) : v
    const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj, bigintReplacer), bigintReviver)

    const cloneEncoders = (): EncoderKeymap => JSON.parse(JSON.stringify(ugoEncoders))
    const cloneLighting = (): Record<LightingSub, LightingConfig> => JSON.parse(JSON.stringify(ugoLighting))
    this.devices = new Map([
      [ugoState.id, { state: deepClone(ugoState), keymap: deepClone(ugoKeymap), encoders: cloneEncoders(), lighting: cloneLighting() }],
      [miniState.id, { state: deepClone(miniState), keymap: deepClone(ugoKeymap), encoders: cloneEncoders(), lighting: cloneLighting() }],
    ])
  }

  async listDevices(): Promise<DeviceSummary[]> {
    return [...this.devices.values()].map(({ state }) => ({
      id: state.id,
      product: state.info?.qmk.product_name ?? 'Unknown',
      manufacturer: state.info?.qmk.manufacturer ?? '',
      secureStatus: state.secure_status,
      status: 'ready' as const,
    }))
  }

  async getDeviceState(id: string): Promise<XapDeviceState> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    return e.state
  }

  async getMappedKeymap(id: string): Promise<MappedKeymap> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    return e.keymap
  }

  async getConstants(): Promise<XapConstants> {
    return ugoConstants
  }

  async remapKey(id: string, target: { layer: number; row: number; column: number }, code: KeyCode): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    const layerKeys = e.keymap.keys[target.layer]
    if (!layerKeys) throw new Error(`layer ${target.layer} not found`)
    const { row, column: col } = target
    for (const rowArr of layerKeys) {
      for (const key of rowArr) {
        if (key && Number(key.layout.matrix.y) === row && Number(key.layout.matrix.x) === col) {
          key.key.code = code
          this.emit({ kind: 'LogReceived', data: { id, log: `remap r${row} c${col} -> ${code.key}` } })
          return
        }
      }
    }
    throw new Error(`key at layer=${target.layer} row=${row} col=${col} not found`)
  }

  async getEncoderKeymap(id: string): Promise<EncoderKeymap> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    return e.encoders
  }

  async setEncoderKeycode(
    id: string,
    target: { layer: number; encoder: number; clockwise: number },
    code: KeyCode,
  ): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    const slot = e.encoders[target.layer]?.[target.encoder]
    if (!slot) throw new Error(`encoder ${target.encoder} layer ${target.layer} not found`)
    slot[target.clockwise ? 'cw' : 'ccw'] = code
    const { encoder, clockwise } = target
    this.emit({ kind: 'LogReceived', data: { id, log: `encoder ${encoder} ${clockwise ? 'CW' : 'CCW'} -> ${code.key}` } })
  }

  async secureLock(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    e.state.secure_status = 'Locked'
    this.emit({ kind: 'SecureStatusChanged', data: { id, secure_status: 'Locked' } })
  }

  async secureUnlock(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    e.state.secure_status = 'Unlocked'
    this.emit({ kind: 'SecureStatusChanged', data: { id, secure_status: 'Unlocked' } })
  }

  async jumpToBootloader(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
  }

  async reinitializeEeprom(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
  }

  async getLightingConfig(id: string, sub: LightingSub): Promise<LightingConfig> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    return e.lighting[sub]
  }

  async setLightingConfig(id: string, sub: LightingSub, config: LightingConfig): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    e.lighting[sub] = config
    this.emit({ kind: 'LogReceived', data: { id, log: `light ${sub} -> mode ${'mode' in config ? config.mode : 'n/a'}` } })
  }

  async saveLightingConfig(id: string, sub: LightingSub): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    this.emit({ kind: 'LogReceived', data: { id, log: `light ${sub} saved` } })
  }

  subscribe(h: (e: XapEvent) => void): Unsubscribe {
    this.handlers.add(h)
    return () => { this.handlers.delete(h) }
  }
}
