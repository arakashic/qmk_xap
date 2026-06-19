import type { XapClient, DeviceSummary, Unsubscribe } from '../client'
import type { XapDeviceState, MappedKeymap, XapEvent, XapConstants, KeyCode } from '../types'
import { ugoState, ugoKeymap } from './fixtures'
import { ugoConstants } from './constants'

type Entry = { state: XapDeviceState; keymap: MappedKeymap }

export class MockXapClient implements XapClient {
  private devices: Map<string, Entry>

  constructor() {
    // Deep-clone the keymap so mutations (remapKey) don't affect the shared fixture.
    const keymap: MappedKeymap = JSON.parse(
      JSON.stringify(ugoKeymap, (_k, v) => (typeof v === 'bigint' ? `__bigint__${v}` : v)),
      (_k, v) => (typeof v === 'string' && v.startsWith('__bigint__') ? BigInt(v.slice(10)) : v),
    )
    this.devices = new Map([[ugoState.id, { state: ugoState, keymap }]])
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

  subscribe(_h: (e: XapEvent) => void): Unsubscribe {
    return () => {}
  }
}
