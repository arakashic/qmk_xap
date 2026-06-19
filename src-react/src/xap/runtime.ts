import { commands } from '@gen/xap-tauri'
import { listen } from '@tauri-apps/api/event'
import type { XapClient } from './client'
import type { XapEvent } from './types'
import { RealXapClient, type XapEventSource } from './real-client'
import { MockXapClient } from './mock/client'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const tauriEvents: XapEventSource = {
  on(handler) {
    const p = listen<XapEvent>('xap-event', (e) => handler(e.payload))
    return () => { void p.then((un) => un()) }
  },
}

export function selectClient(): XapClient {
  if (isTauri()) {
    return new RealXapClient(commands, tauriEvents)
  }
  // TODO(plan6 follow-up): web/WebHID branch once xap-wasm is built
  return new MockXapClient()
}
