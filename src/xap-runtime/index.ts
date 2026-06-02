import { tauriRuntime } from './tauri'
import type { XapRuntime } from './types'

// Phase 8 will branch here on whether Tauri is present vs browser.
export const runtime: XapRuntime = tauriRuntime

export const commands = runtime.commands
export const backendCapabilities = runtime.capabilities
export const connectDevice = () => runtime.connectDevice()
export const addBackendListener = (h: Parameters<XapRuntime['addEventListener']>[0]) =>
    runtime.addEventListener(h)
export const clearBackendListener = () => runtime.clearEventListener()

export type * from './types'
