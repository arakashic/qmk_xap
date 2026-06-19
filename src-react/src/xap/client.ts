import type { XapDeviceState, MappedKeymap, XapSecureStatus, XapEvent, XapConstants, KeyCode } from './types'

export interface DeviceSummary {
  id: string
  product: string
  manufacturer: string
  secureStatus: XapSecureStatus
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
  // later plans: lighting get/set/save
  subscribe(handler: (e: XapEvent) => void): Unsubscribe
}
