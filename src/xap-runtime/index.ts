import { tauriRuntime } from './tauri'
import { browserRuntime } from './browser'
import type { XapRuntime } from './types'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
export const runtime: XapRuntime = isTauri ? tauriRuntime : browserRuntime

export const commands = runtime.commands
export const backendCapabilities = runtime.capabilities
export const connectDevice = () => runtime.connectDevice()
export const addBackendListener = (h: Parameters<XapRuntime['addEventListener']>[0]) =>
    runtime.addEventListener(h)
export const clearBackendListener = () => runtime.clearEventListener()

export type * from './types'
