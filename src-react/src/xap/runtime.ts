import { commands } from '@gen/xap-tauri'
import { listen } from '@tauri-apps/api/event'
import type { XapClient } from './client'
import type { XapEvent } from './types'
import { RealXapClient, type XapEventSource } from './real-client'
import { MockXapClient } from './mock/client'
import { isWebHIDSupported } from './web/webhid'
import { getWebClient } from './web/web-client'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Dev/demo opt-in for the mock client in a browser: `?mock=1` or
// localStorage['xap-client']==='mock'. Lets UI iteration run without a device
// even though the web app now defaults to real WebHID transport.
function wantsMock(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URL(window.location.href).searchParams.get('mock') === '1') return true
    return window.localStorage.getItem('xap-client') === 'mock'
  } catch {
    return false
  }
}

const tauriEvents: XapEventSource = {
  on(handler) {
    const p = listen<XapEvent>('xap', (e) => handler(e.payload))
    return () => { void p.then((un) => un()) }
  },
}

export type ClientKind = 'tauri' | 'web' | 'mock'

// Which transport this runtime resolves to. Tauri desktop → 'tauri'; a browser
// with `?mock=1` (or localStorage) → 'mock'; a WebHID browser → 'web'; otherwise
// 'mock'. Drives both selectClient and the web-only connect affordance.
export function activeClientKind(): ClientKind {
  if (isTauri()) return 'tauri'
  if (wantsMock()) return 'mock'
  if (isWebHIDSupported()) return 'web'
  return 'mock'
}

export function selectClient(): XapClient {
  switch (activeClientKind()) {
    case 'tauri':
      return new RealXapClient(commands, tauriEvents)
    case 'web':
      return getWebClient()
    default:
      return new MockXapClient()
  }
}
