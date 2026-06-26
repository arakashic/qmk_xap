import { commands } from '@gen/xap-tauri'
import { listen } from '@tauri-apps/api/event'
import type { XapClient } from './client'
import type { XapEvent } from './types'
import { RealXapClient, type XapEventSource } from './real-client'
import { isWebHIDSupported } from './web/webhid'
import { getWebClient } from './web/web-client'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const tauriEvents: XapEventSource = {
  on(handler) {
    const p = listen<XapEvent>('xap', (e) => handler(e.payload))
    return () => { void p.then((un) => un()) }
  },
}

// Inert client for non-WebHID browsers (Firefox/Safari). App short-circuits the
// 'unsupported' kind to a landing before rendering device data, so only
// subscribe (called in an effect) needs to be a safe no-op; the rest reject.
function unsupportedClient(): XapClient {
  const fail = () => Promise.reject(new Error('No XAP transport: this browser lacks WebHID.'))
  return {
    listDevices: () => Promise.resolve([]),
    getDeviceState: fail,
    getMappedKeymap: fail,
    getConstants: fail,
    remapKey: fail,
    getEncoderKeymap: fail,
    setEncoderKeycode: fail,
    secureLock: fail,
    secureUnlock: fail,
    jumpToBootloader: fail,
    reinitializeEeprom: fail,
    getLightingConfig: fail,
    setLightingConfig: fail,
    saveLightingConfig: fail,
    subscribe: () => () => {},
  }
}

export type ClientKind = 'tauri' | 'web' | 'mock' | 'unsupported'

// Which transport this runtime resolves to. Tauri desktop → 'tauri'; a
// `VITE_MOCK=1` build → 'mock' (mock is excluded from every other build); a
// WebHID browser → 'web'; a browser without WebHID (Firefox/Safari) →
// 'unsupported'. Drives selectClient, the web-only connect affordance, and the
// unsupported-browser landing.
export function activeClientKind(): ClientKind {
  if (isTauri()) return 'tauri'
  if (import.meta.env.VITE_MOCK) return 'mock'
  if (isWebHIDSupported()) return 'web'
  return 'unsupported'
}

// Async because the mock is loaded via a dynamic import gated on VITE_MOCK, so
// default/debug/release builds tree-shake it out of the bundle entirely.
export async function selectClient(): Promise<XapClient> {
  if (isTauri()) return new RealXapClient(commands, tauriEvents)
  if (import.meta.env.VITE_MOCK) {
    const { MockXapClient } = await import('./mock/client')
    return new MockXapClient()
  }
  if (isWebHIDSupported()) return getWebClient()
  return unsupportedClient()
}
