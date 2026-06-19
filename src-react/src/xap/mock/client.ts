import type { XapClient, DeviceSummary, Unsubscribe } from '../client'
import type { XapDeviceState, MappedKeymap, XapEvent } from '../types'
import { ugoState, ugoKeymap } from './fixtures'

type Entry = { state: XapDeviceState; keymap: MappedKeymap }

export class MockXapClient implements XapClient {
  private devices = new Map<string, Entry>([
    [ugoState.id, { state: ugoState, keymap: ugoKeymap }],
  ])

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

  subscribe(_h: (e: XapEvent) => void): Unsubscribe {
    return () => {}
  }
}
