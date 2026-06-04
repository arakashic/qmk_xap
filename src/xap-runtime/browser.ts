import init, { XapWasmClient } from '@generated/xap-wasm/xap_wasm.js'
import type { XapEvent } from '@generated/xap-types'
import type { XapRuntime, BackendCapabilities, XapCommands, XapEventHandler } from './types'
import { WebHIDTransport, isWebHIDSupported } from './webhid'
import { generatedCommands } from './generated-commands'

const webhid = new WebHIDTransport()

let handler: XapEventHandler | undefined

const sendReportCb = (deviceId: string, data: Uint8Array) => {
    webhid.sendReport(deviceId, data).catch(e => console.error('sendReport failed', e))
}

const emitEventCb = (event: XapEvent) => {
    handler?.(event)
}

let clientPromise: Promise<XapWasmClient> | null = null
function ensureClient(): Promise<XapWasmClient> {
    if (!clientPromise) {
        clientPromise = (async () => {
            await init()
            return new XapWasmClient(sendReportCb, emitEventCb)
        })()
    }
    return clientPromise
}

const capabilities: BackendCapabilities = {
    requiresUserConnect: true,
    unsupportedReason: isWebHIDSupported()
        ? null
        : 'WebHID is not supported in this browser. Use Chrome/Edge over HTTPS or localhost.',
}

async function connectDevice(): Promise<void> {
    const client = await ensureClient()

    const onInput = (id: string, bytes: Uint8Array) => client.handle_input_report(id, bytes)
    const onDisconnect = (id: string) => {
        client.remove_device(id)
        handler?.({ kind: 'RemovedDevice', data: { id } } as XapEvent)
    }

    const newIds = await webhid.requestAndOpen(onInput, onDisconnect)
    for (const id of newIds) {
        client.add_device(id)
        handler?.({ kind: 'NewDevice', data: { id } } as XapEvent)
    }
}

async function addEventListener(h: XapEventHandler): Promise<void> {
    handler = h
    // Pre-warm so the wasm client + emit callback exist before any device connects.
    await ensureClient()
}

function clearEventListener(): void {
    handler = undefined
}

function wrap<T>(p: Promise<T>) {
    return p
        .then(data => ({ status: 'ok' as const, data }))
        .catch(e => ({ status: 'error' as const, error: String(e?.message ?? e) }))
}

const commands = {
    ...generatedCommands(ensureClient, wrap),

    // Hand-written, non-route commands (mirror of src-tauri/src/rpc/commands.rs):
    // RAW (return value directly)
    devicesGet: async () => (await ensureClient()).devices() ?? [],
    decodeKeycode: async (code: number) => (await ensureClient()).decode_keycode(code),
    xapConstantsGet: async () => (await ensureClient()).xap_constants(),

    // RESULT-wrapped aggregation / local
    keycodeTemplateEncode: (template: unknown) =>
        wrap(ensureClient().then(c => c.keycode_template_encode(template))),
    deviceGet: (id: string) => wrap(ensureClient().then(c => c.device_get(id))),
    keymapGet: (id: string, layout: string) =>
        wrap(ensureClient().then(c => c.keymap_get(id, layout))),
    remapKey: (id: string, arg: unknown) => wrap(ensureClient().then(c => c.remap_key(id, arg))),
    encoderKeymapGet: (id: string) => wrap(ensureClient().then(c => c.encoder_keymap_get(id))),
} satisfies XapCommands

export const browserRuntime: XapRuntime = {
    capabilities,
    commands,
    connectDevice,
    addEventListener,
    clearEventListener,
}
