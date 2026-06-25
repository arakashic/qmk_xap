import type { XapDeviceState, MappedKeymap, XapSecureStatus, XapEvent, XapConstants, KeyCode, BacklightConfig, RgbLightConfig, RgbMatrixConfig } from './types'

export type LightingSub = 'backlight' | 'rgblight' | 'rgbmatrix'
export type LightingConfig = BacklightConfig | RgbLightConfig | RgbMatrixConfig

// Per-device lifecycle. Mock/desktop only surface fully-interrogated devices, so
// they always report 'ready'; the web transport reports the real arrival phases.
export type DeviceStatus = 'connecting' | 'interrogating' | 'ready' | 'failed'

export interface DeviceSummary {
  id: string
  product: string
  manufacturer: string
  secureStatus: XapSecureStatus
  status: DeviceStatus
  /** Populated when status === 'failed'. */
  error?: string
}

export type Unsubscribe = () => void

export type EncoderSlots = { ccw: KeyCode; cw: KeyCode }
export type EncoderKeymap = EncoderSlots[][]  // [layer][encoder]

export interface XapClient {
  listDevices(): Promise<DeviceSummary[]>
  getDeviceState(id: string): Promise<XapDeviceState>
  getMappedKeymap(id: string): Promise<MappedKeymap>
  getConstants(): Promise<XapConstants>
  // UI-facing: takes a rich KeyCode; the future real adapter (Plan 6) encodes it to u16.
  remapKey(id: string, target: { layer: number; row: number; column: number }, code: KeyCode): Promise<void>
  getEncoderKeymap(id: string): Promise<EncoderKeymap>
  // UI-facing rich KeyCode (real u16 deferred to Plan 6). clockwise: 0 = CCW, 1 = CW.
  setEncoderKeycode(id: string, target: { layer: number; encoder: number; clockwise: number }, code: KeyCode): Promise<void>
  // UI-facing: real effects deferred to Plan 6. Mock: flips secure_status immediately.
  secureLock(id: string): Promise<void>
  secureUnlock(id: string): Promise<void>
  // Mock: resolved no-ops; real effects deferred to Plan 6.
  jumpToBootloader(id: string): Promise<void>
  reinitializeEeprom(id: string): Promise<void>
  getLightingConfig(id: string, sub: LightingSub): Promise<LightingConfig>
  setLightingConfig(id: string, sub: LightingSub, config: LightingConfig): Promise<void>
  saveLightingConfig(id: string, sub: LightingSub): Promise<void>
  subscribe(handler: (e: XapEvent) => void): Unsubscribe
}
