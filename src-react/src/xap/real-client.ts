import type { XapClient, DeviceSummary, Unsubscribe, EncoderKeymap, LightingSub, LightingConfig } from './client'
import type { XapDeviceState, MappedKeymap, XapConstants, XapEvent, KeyCode, KeycodeTemplate, BacklightConfig, RgbLightConfig, RgbMatrixConfig } from './types'
import type { Result, RemappingSetKeycodeArg, RemappingSetEncoderKeycodeArg, QmkJumpToBootloaderResponse, QmkReinitializeEepromResponse } from '@gen/xap-types'
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
  xapSecureLock(id: string): Promise<Result<null, string>>
  xapSecureUnlock(id: string): Promise<Result<null, string>>
  qmkJumpToBootloader(id: string): Promise<Result<QmkJumpToBootloaderResponse, string>>
  qmkReinitializeEeprom(id: string): Promise<Result<QmkReinitializeEepromResponse, string>>
  backlightGetConfig(id: string): Promise<Result<BacklightConfig, string>>
  backlightSetConfig(id: string, arg: BacklightConfig): Promise<Result<null, string>>
  backlightSaveConfig(id: string): Promise<Result<null, string>>
  rgblightGetConfig(id: string): Promise<Result<RgbLightConfig, string>>
  rgblightSetConfig(id: string, arg: RgbLightConfig): Promise<Result<null, string>>
  rgblightSaveConfig(id: string): Promise<Result<null, string>>
  rgbmatrixGetConfig(id: string): Promise<Result<RgbMatrixConfig, string>>
  rgbmatrixSetConfig(id: string, arg: RgbMatrixConfig): Promise<Result<null, string>>
  rgbmatrixSaveConfig(id: string): Promise<Result<null, string>>
}

// Injected event source — desktop adapter wraps Tauri listen; web adapter wraps wasm emit.
export interface XapEventSource {
  on(handler: (e: XapEvent) => void): Unsubscribe
}

export class RealXapClient implements XapClient {
  constructor(private commands: XapCommands, private events: XapEventSource) {}

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
      status: 'ready' as const,
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

  async secureLock(id: string): Promise<void> {
    unwrap(await this.commands.xapSecureLock(id))
  }

  async secureUnlock(id: string): Promise<void> {
    unwrap(await this.commands.xapSecureUnlock(id))
  }

  async jumpToBootloader(id: string): Promise<void> {
    unwrap(await this.commands.qmkJumpToBootloader(id))
  }

  async reinitializeEeprom(id: string): Promise<void> {
    unwrap(await this.commands.qmkReinitializeEeprom(id))
  }

  async getLightingConfig(id: string, sub: LightingSub): Promise<LightingConfig> {
    if (sub === 'backlight') return unwrap(await this.commands.backlightGetConfig(id))
    if (sub === 'rgblight')  return unwrap(await this.commands.rgblightGetConfig(id))
    return unwrap(await this.commands.rgbmatrixGetConfig(id))
  }

  async setLightingConfig(id: string, sub: LightingSub, config: LightingConfig): Promise<void> {
    if (sub === 'backlight') { unwrap(await this.commands.backlightSetConfig(id, config as BacklightConfig)); return }
    if (sub === 'rgblight')  { unwrap(await this.commands.rgblightSetConfig(id, config as RgbLightConfig)); return }
    unwrap(await this.commands.rgbmatrixSetConfig(id, config as RgbMatrixConfig))
  }

  async saveLightingConfig(id: string, sub: LightingSub): Promise<void> {
    if (sub === 'backlight') { unwrap(await this.commands.backlightSaveConfig(id)); return }
    if (sub === 'rgblight')  { unwrap(await this.commands.rgblightSaveConfig(id)); return }
    unwrap(await this.commands.rgbmatrixSaveConfig(id))
  }

  subscribe(handler: (e: XapEvent) => void): Unsubscribe {
    return this.events.on(handler)
  }
}
