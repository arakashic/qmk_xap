// Web (browser) XapClient: xap-wasm protocol logic over a WebHID transport.
// Reuses RealXapClient by injecting a wasm-backed XapCommands + an event source.
// The wasm module is loaded lazily (dynamic import) on first connect, so this
// file is import-safe in tests and on the desktop build.
import type { XapWasmClient } from '@gen/xap-wasm/xap_wasm.js'
import type { XapClient, Unsubscribe } from '../client'
import type { XapEvent } from '../types'
import { RealXapClient, type XapEventSource } from '../real-client'
import { WebHIDTransport, isWebHIDSupported } from './webhid'
import { makeWasmCommands } from './wasm-commands'

export { isWebHIDSupported }

const handlers = new Set<(e: XapEvent) => void>()
const emit = (e: XapEvent) => { for (const h of handlers) h(e) }

const webhid = new WebHIDTransport()

let clientPromise: Promise<XapWasmClient> | null = null
function ensureClient(): Promise<XapWasmClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { default: init, XapWasmClient } = await import('@gen/xap-wasm/xap_wasm.js')
      await init()
      const sendReport = (deviceId: string, data: Uint8Array) => {
        webhid.sendReport(deviceId, data).catch((e) => console.error('sendReport failed', e))
      }
      const emitEvent = (event: XapEvent) => emit(event)
      return new XapWasmClient(sendReport, emitEvent)
    })()
  }
  return clientPromise
}

const webEvents: XapEventSource = {
  on(handler): Unsubscribe {
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  },
}

/** Prompt the WebHID device chooser (requires a user gesture), open + interrogate
 *  the selected device(s), and emit NewDevice so the UI can refetch. */
export async function connectWebDevice(): Promise<void> {
  const client = await ensureClient()
  const onInput = (id: string, bytes: Uint8Array) => client.handle_input_report(id, bytes)
  const onDisconnect = (id: string) => {
    client.remove_device(id)
    emit({ kind: 'RemovedDevice', data: { id } })
  }
  const newIds = await webhid.requestAndOpen(onInput, onDisconnect)
  for (const id of newIds) {
    client.add_device(id)
    // Full device interrogation (info + keymap + secure) so devices()/device_state
    // return a populated state immediately after connect.
    try { await client.device_get(id) } catch (e) { console.error('device_get failed', e) }
    emit({ kind: 'NewDevice', data: { id } })
  }
}

let webClient: XapClient | null = null
export function getWebClient(): XapClient {
  if (!webClient) {
    webClient = new RealXapClient(makeWasmCommands(ensureClient), webEvents)
  }
  return webClient
}
