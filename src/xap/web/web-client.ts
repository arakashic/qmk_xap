// Web (browser) XapClient: xap-wasm protocol logic over a WebHID transport.
// Reuses RealXapClient by injecting a wasm-backed XapCommands + an event source.
// The wasm module is loaded lazily (dynamic import) on first connect, so this
// file is import-safe in tests and on the desktop build.
import type { XapWasmClient } from '@gen/xap-wasm/xap_wasm.js'
import type { XapClient, Unsubscribe, DeviceSummary, DeviceStatus } from '../client'
import type { XapEvent } from '../types'
import { RealXapClient, type XapEventSource } from '../real-client'
import { WebHIDTransport, isWebHIDSupported, type DeviceArrival } from './webhid'
import { makeWasmCommands } from './wasm-commands'

export { isWebHIDSupported }

const handlers = new Set<(e: XapEvent) => void>()
const emit = (e: XapEvent) => { for (const h of handlers) h(e) }

const webhid = new WebHIDTransport()

// Per-device lifecycle, tracked in TS. add_device inserts a bare stub into the
// wasm `devices()` list immediately (no info until interrogation finishes), so
// this map carries the real phase (connecting/interrogating/failed) plus the
// HID product name for listDevices() to surface before the device is ready.
type StatusEntry = { status: DeviceStatus; product?: string; error?: string }
const deviceStatus = new Map<string, StatusEntry>()

let wasm: XapWasmClient | null = null
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
      wasm = new XapWasmClient(sendReport, emitEvent)
      return wasm
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

// Drive a newly-arrived device through connecting → interrogating → ready/failed,
// emitting NewDevice on each transition so the UI refetches and renders the phase.
async function arrive(arrivals: DeviceArrival[]): Promise<void> {
  const client = await ensureClient()
  for (const { id, productName } of arrivals) {
    deviceStatus.set(id, { status: 'connecting', product: productName })
    emit({ kind: 'NewDevice', data: { id } })
    try {
      client.add_device(id)
      deviceStatus.set(id, { status: 'interrogating', product: productName })
      emit({ kind: 'NewDevice', data: { id } })
      // Full device interrogation (info + keymap + secure) so devices()/device_state
      // return a populated state once we report 'ready'.
      await client.device_get(id)
      deviceStatus.set(id, { status: 'ready', product: productName })
      emit({ kind: 'NewDevice', data: { id } })
    } catch (e) {
      deviceStatus.set(id, { status: 'failed', product: productName, error: String((e as Error)?.message ?? e) })
      emit({ kind: 'NewDevice', data: { id } })
    }
  }
}

let initialized = false
/** Register the disconnect listener so unplugged devices are cleaned up.
 *  Idempotent; safe to call from app load and from the connect button. We do NOT
 *  open any device here: opening a getDevices()/connect-event handle without a
 *  user gesture triggers the macOS Input Monitoring prompt (see webhid.ts).
 *  Devices are only opened via the explicit connect flow. */
export function initWebTransport(): void {
  if (initialized) return
  initialized = true
  webhid.init({
    onInput: (id, bytes) => wasm?.handle_input_report(id, bytes),
    onDisconnect: (id) => {
      deviceStatus.delete(id)
      wasm?.remove_device(id)
      emit({ kind: 'RemovedDevice', data: { id } })
    },
  })
}

/** Prompt the WebHID device chooser (requires a user gesture), open + interrogate
 *  the selected device(s). Returns how many new devices were added and whether the
 *  pick was a no-op because the device was already connected. */
export async function connectWebDevice(): Promise<{ added: number; alreadyConnected: boolean }> {
  await ensureClient()
  initWebTransport()
  const { newDevices, alreadyConnected } = await webhid.requestAndOpen()
  await arrive(newDevices)
  return { added: newDevices.length, alreadyConnected }
}

// Web client: RealXapClient over wasm, with listDevices merged against the TS
// status map so in-progress (connecting/interrogating/failed) devices are visible.
class WebXapClient extends RealXapClient {
  async listDevices(): Promise<DeviceSummary[]> {
    const ready = await super.listDevices()
    const byId = new Map(ready.map((d) => [d.id, d]))
    for (const [id, s] of deviceStatus) {
      const existing = byId.get(id)
      if (existing) {
        // Before interrogation completes the wasm stub has no info, so its
        // product is 'Unknown'. Prefer the HID product name we tracked at open
        // time while still pending; trust the wasm product_name once ready.
        const product = s.status === 'ready' ? existing.product : (s.product ?? existing.product)
        byId.set(id, { ...existing, product, status: s.status, error: s.error })
      } else if (s.status !== 'ready') {
        byId.set(id, {
          id,
          product: s.product ?? 'Keyboard',
          manufacturer: '',
          secureStatus: 'Locked',
          status: s.status,
          error: s.error,
        })
      }
    }
    return [...byId.values()]
  }
}

let webClient: XapClient | null = null
export function getWebClient(): XapClient {
  if (!webClient) {
    webClient = new WebXapClient(makeWasmCommands(ensureClient), webEvents)
  }
  return webClient
}
