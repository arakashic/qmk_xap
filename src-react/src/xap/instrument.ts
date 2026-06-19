import type { XapClient, Unsubscribe, EncoderKeymap, DeviceSummary } from './client'
import type { XapDeviceState, MappedKeymap, XapEvent, XapConstants, KeyCode } from './types'

export interface DevtoolsSink {
  pushCall(label: string): string
  resolveCall(id: string, status: 'ok' | 'error', latencyMs: number): void
}

// Small helper: times an async fn, records push/resolve into sink.
async function timed<T>(
  sink: DevtoolsSink,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const id = sink.pushCall(label)
  const t0 = performance.now()
  try {
    const result = await fn()
    sink.resolveCall(id, 'ok', performance.now() - t0)
    return result
  } catch (err) {
    sink.resolveCall(id, 'error', performance.now() - t0)
    throw err
  }
}

export function instrumentClient(client: XapClient, sink: DevtoolsSink): XapClient {
  return {
    listDevices(): Promise<DeviceSummary[]> {
      return timed(sink, 'listDevices', () => client.listDevices())
    },

    getDeviceState(id: string): Promise<XapDeviceState> {
      return timed(sink, 'getDeviceState', () => client.getDeviceState(id))
    },

    getMappedKeymap(id: string): Promise<MappedKeymap> {
      return timed(sink, 'getMappedKeymap', () => client.getMappedKeymap(id))
    },

    getConstants(): Promise<XapConstants> {
      return timed(sink, 'getConstants', () => client.getConstants())
    },

    remapKey(
      id: string,
      target: { layer: number; row: number; column: number },
      code: KeyCode,
    ): Promise<void> {
      const label = `remapKey · L${target.layer} r${target.row} c${target.column}`
      return timed(sink, label, () => client.remapKey(id, target, code))
    },

    getEncoderKeymap(id: string): Promise<EncoderKeymap> {
      return timed(sink, 'getEncoderKeymap', () => client.getEncoderKeymap(id))
    },

    setEncoderKeycode(
      id: string,
      target: { layer: number; encoder: number; clockwise: number },
      code: KeyCode,
    ): Promise<void> {
      const dir = target.clockwise ? 'CW' : 'CCW'
      const label = `setEncoderKeycode · enc${target.encoder} ${dir}`
      return timed(sink, label, () => client.setEncoderKeycode(id, target, code))
    },

    secureLock(id: string): Promise<void> {
      return timed(sink, 'secureLock', () => client.secureLock(id))
    },

    secureUnlock(id: string): Promise<void> {
      return timed(sink, 'secureUnlock', () => client.secureUnlock(id))
    },

    jumpToBootloader(id: string): Promise<void> {
      return timed(sink, 'jumpToBootloader', () => client.jumpToBootloader(id))
    },

    reinitializeEeprom(id: string): Promise<void> {
      return timed(sink, 'reinitializeEeprom', () => client.reinitializeEeprom(id))
    },

    subscribe(handler: (e: XapEvent) => void): Unsubscribe {
      return client.subscribe(handler)
    },
  }
}
