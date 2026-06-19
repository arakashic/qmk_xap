import type { XapClient, DeviceSummary, Unsubscribe, EncoderKeymap } from './client'
import type { XapDeviceState, MappedKeymap, XapConstants, XapEvent, KeyCode } from './types'
import type { Result } from '@gen/xap-types'
import { unwrap } from './result'

// Structural interface covering only the commands used in this adapter.
// Extended in Tasks 2-3 for mutations and encoder reads.
export interface XapCommands {
  devicesGet(): Promise<XapDeviceState[]>
  deviceGet(id: string): Promise<Result<XapDeviceState, string>>
  keymapGet(id: string, layout: string): Promise<Result<MappedKeymap, string>>
  xapConstantsGet(): Promise<XapConstants>
}

export class RealXapClient implements XapClient {
  constructor(private commands: XapCommands) {}

  async listDevices(): Promise<DeviceSummary[]> {
    const states = await this.commands.devicesGet()
    return states.map((state) => ({
      id: state.id,
      product: state.info?.qmk.product_name ?? 'Unknown',
      manufacturer: state.info?.qmk.manufacturer ?? '',
      secureStatus: state.secure_status,
    }))
  }

  async getDeviceState(id: string): Promise<XapDeviceState> {
    return unwrap(await this.commands.deviceGet(id))
  }

  async getMappedKeymap(id: string): Promise<MappedKeymap> {
    const state = await this.getDeviceState(id)
    const layout = Object.keys(state.config.layouts)[0] ?? ''
    return unwrap(await this.commands.keymapGet(id, layout))
  }

  async getConstants(): Promise<XapConstants> {
    return await this.commands.xapConstantsGet()
  }

  // --- Stubs for Task 2/3 ---

  async remapKey(_id: string, _target: { layer: number; row: number; column: number }, _code: KeyCode): Promise<void> {
    throw new Error('not implemented (Task 2)')
  }

  async getEncoderKeymap(_id: string): Promise<EncoderKeymap> {
    throw new Error('not implemented (Task 2)')
  }

  async setEncoderKeycode(_id: string, _target: { layer: number; encoder: number; clockwise: number }, _code: KeyCode): Promise<void> {
    throw new Error('not implemented (Task 2)')
  }

  async secureLock(_id: string): Promise<void> {
    throw new Error('not implemented (Task 2)')
  }

  async secureUnlock(_id: string): Promise<void> {
    throw new Error('not implemented (Task 2)')
  }

  async jumpToBootloader(_id: string): Promise<void> {
    throw new Error('not implemented (Task 2)')
  }

  async reinitializeEeprom(_id: string): Promise<void> {
    throw new Error('not implemented (Task 2)')
  }

  subscribe(_handler: (e: XapEvent) => void): Unsubscribe {
    throw new Error('not implemented (Task 3)')
  }
}
