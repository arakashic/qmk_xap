import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event'
import { commands } from '@generated/xap-tauri'
import type { XapEvent } from '@generated/xap-types'
import type { XapRuntime, BackendCapabilities, XapEventHandler } from './types'

let unlisten: UnlistenFn | undefined

const capabilities: BackendCapabilities = {
    requiresUserConnect: false,
    unsupportedReason: null,
}

export const tauriRuntime: XapRuntime = {
    capabilities,
    commands,
    async connectDevice() {
        // Desktop enumerates automatically; nothing to do.
    },
    async addEventListener(handler: XapEventHandler) {
        unlisten = await listen('xap', (event: Event<XapEvent>) => handler(event.payload))
    },
    clearEventListener() {
        unlisten?.()
        unlisten = undefined
    },
}
