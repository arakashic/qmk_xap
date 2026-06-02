import type { XapEvent } from '@generated/xap'
import type { commands as tauriCommands } from '@generated/xap'

export type XapCommands = typeof tauriCommands

export interface BackendCapabilities {
    requiresUserConnect: boolean
    unsupportedReason: string | null
}

export type XapEventHandler = (event: XapEvent) => void

export interface XapRuntime {
    readonly capabilities: BackendCapabilities
    readonly commands: XapCommands
    connectDevice(): Promise<void>
    addEventListener(handler: XapEventHandler): Promise<void>
    clearEventListener(): void
}
