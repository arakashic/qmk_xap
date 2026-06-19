import type { XapClient, DeviceSummary, Unsubscribe, EncoderKeymap } from '../client'
import type { XapDeviceState, MappedKeymap, XapEvent, XapConstants, KeyCode } from '../types'
import { ugoState, ugoKeymap, miniState } from './fixtures'
import { ugoConstants } from './constants'
import { ugoEncoders } from './encoders'

type Entry = { state: XapDeviceState; keymap: MappedKeymap; encoders: EncoderKeymap }

export class MockXapClient implements XapClient {
  private devices: Map<string, Entry>

  constructor() {
    // Deep-clone fixtures so mutations don't affect shared fixture objects.
    // bigint-safe replacer/reviver needed for state (matrix_size) and keymap.
    const bigintReplacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? `__bigint__${v}` : v)
    const bigintReviver = (_k: string, v: unknown) =>
      typeof v === 'string' && v.startsWith('__bigint__') ? BigInt(v.slice(10)) : v
    const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj, bigintReplacer), bigintReviver)

    const cloneEncoders = (): EncoderKeymap => JSON.parse(JSON.stringify(ugoEncoders))
    this.devices = new Map([
      [ugoState.id, { state: deepClone(ugoState), keymap: deepClone(ugoKeymap), encoders: cloneEncoders() }],
      [miniState.id, { state: deepClone(miniState), keymap: deepClone(ugoKeymap), encoders: cloneEncoders() }],
    ])
  }

  async listDevices(): Promise<DeviceSummary[]> {
    return [...this.devices.values()].map(({ state }) => ({
      id: state.id,
      product: state.info?.qmk.product_name ?? 'Unknown',
      manufacturer: state.info?.qmk.manufacturer ?? '',
      secureStatus: state.secure_status,
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
    for (const row of layerKeys) {
      for (const key of row) {
        if (
          key &&
          Number(key.layout.matrix.y) === target.row &&
          Number(key.layout.matrix.x) === target.column
        ) {
          key.key.code = code
          return
        }
      }
    }
    throw new Error(`key at layer=${target.layer} row=${target.row} col=${target.column} not found`)
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
  }

  async secureLock(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    e.state.secure_status = 'Locked'
  }

  async secureUnlock(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
    e.state.secure_status = 'Unlocked'
  }

  async jumpToBootloader(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
  }

  async reinitializeEeprom(id: string): Promise<void> {
    const e = this.devices.get(id)
    if (!e) throw new Error(`unknown device ${id}`)
  }

  subscribe(_h: (e: XapEvent) => void): Unsubscribe {
    return () => {}
  }
}
