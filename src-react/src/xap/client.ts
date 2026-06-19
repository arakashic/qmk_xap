import type { XapDeviceState, MappedKeymap, XapSecureStatus, XapEvent } from './types'

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
  // later plans: getEncoderKeymap, remapKey, setEncoderKeycode, secureLock/Unlock,
  // lighting get/set/save, getConstants, jumpToBootloader, reinitializeEeprom
  subscribe(handler: (e: XapEvent) => void): Unsubscribe
}
