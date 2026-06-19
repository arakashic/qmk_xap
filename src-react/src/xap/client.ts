import type { XapDeviceState, MappedKeymap, XapSecureStatus, XapEvent, XapConstants, KeyCode } from './types'

export interface DeviceSummary {
  id: string
  product: string
  manufacturer: string
  secureStatus: XapSecureStatus
}

export type Unsubscribe = () => void

export interface XapClient {
  listDevices(): Promise<DeviceSummary[]>
  getDeviceState(id: string): Promise<XapDeviceState>
  getMappedKeymap(id: string): Promise<MappedKeymap>
  getConstants(): Promise<XapConstants>
  // UI-facing: takes a rich KeyCode; the future real adapter (Plan 6) encodes it to u16.
  remapKey(id: string, target: { layer: number; row: number; column: number }, code: KeyCode): Promise<void>
  // later plans: getEncoderKeymap, setEncoderKeycode, secureLock/Unlock,
  // lighting get/set/save, jumpToBootloader, reinitializeEeprom
  subscribe(handler: (e: XapEvent) => void): Unsubscribe
}
