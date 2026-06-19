import type { XapClient, DeviceSummary, Unsubscribe, EncoderKeymap } from './client'
import type { XapDeviceState, MappedKeymap, XapConstants, XapEvent, KeyCode, KeycodeTemplate } from './types'
import type { Result, RemappingSetKeycodeArg, RemappingSetEncoderKeycodeArg } from '@gen/xap-types'
import { unwrap } from './result'

// Structural interface covering only the commands used in this adapter.
export interface XapCommands {
  devicesGet(): Promise<XapDeviceState[]>
  deviceGet(id: string): Promise<Result<XapDeviceState, string>>
  keymapGet(id: string, layout: string): Promise<Result<MappedKeymap, string>>
  xapConstantsGet(): Promise<XapConstants>
  remapKey(id: string, arg: RemappingSetKeycodeArg): Promise<Result<null, string>>
  keycodeTemplateEncode(template: KeycodeTemplate): Promise<Result<number, string>>
  remappingSetEncoderKeycode(id: string, arg: RemappingSetEncoderKeycodeArg): Promise<Result<null, string>>
  encoderKeymapGet(id: string): Promise<Result<KeyCode[][][], string>>
}

export class RealXapClient implements XapClient {
  constructor(private commands: XapCommands) {}

  private async encodeKeyCode(code: KeyCode): Promise<number> {
    if (code.template) {
      return unwrap(await this.commands.keycodeTemplateEncode(code.template))
    }
    return code.code ?? 0
  }

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

  async remapKey(id: string, target: { layer: number; row: number; column: number }, code: KeyCode): Promise<void> {
    const keycode = await this.encodeKeyCode(code)
    unwrap(await this.commands.remapKey(id, { ...target, keycode }))
  }

  async getEncoderKeymap(id: string): Promise<EncoderKeymap> {
    const tensor = unwrap(await this.commands.encoderKeymapGet(id))
    return tensor.map((layer) => layer.map((dirs) => ({ ccw: dirs[0], cw: dirs[1] })))
  }

  async setEncoderKeycode(id: string, target: { layer: number; encoder: number; clockwise: number }, code: KeyCode): Promise<void> {
    const keycode = await this.encodeKeyCode(code)
    unwrap(await this.commands.remappingSetEncoderKeycode(id, { ...target, keycode }))
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
