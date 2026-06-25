import { describe, it, expect, afterEach, vi } from 'vitest'
import { listen } from '@tauri-apps/api/event'

// Mock @tauri-apps/api/event so importing listen doesn't fail in jsdom
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

// Import after mocks are registered
const { selectClient, activeClientKind } = await import('./runtime')
const { RealXapClient } = await import('./real-client')
const { MockXapClient } = await import('./mock/client')

function setHid(present: boolean) {
  if (present) Object.defineProperty(navigator, 'hid', { value: {}, configurable: true })
  else delete (navigator as unknown as Record<string, unknown>)['hid']
}

describe('selectClient', () => {
  afterEach(() => {
    // Clean up any __TAURI_INTERNALS__ property added during tests
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
  })

  it('returns RealXapClient when __TAURI_INTERNALS__ is present on window', () => {
    ;(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {}
    const client = selectClient()
    expect(client).toBeInstanceOf(RealXapClient)
  })

  it('returns MockXapClient when __TAURI_INTERNALS__ is absent', () => {
    const client = selectClient()
    expect(client).toBeInstanceOf(MockXapClient)
  })

  // Regression: the desktop adapter must subscribe on the SAME channel the Rust
  // backend emits on (`handle.emit("xap", ...)`). It previously listened on the
  // stale tauri-specta name 'xap-event', so no broadcast ever reached the UI
  // (caught only by the Plan 6 end-to-end sim run, not the mocked unit tests).
  it('subscribes Tauri broadcasts on the "xap" channel (matches backend emit)', () => {
    ;(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {}
    selectClient().subscribe(() => {})
    expect(vi.mocked(listen)).toHaveBeenCalledWith('xap', expect.any(Function))
  })
})

describe('activeClientKind', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
    setHid(false)
    window.localStorage.clear()
  })

  it('is "tauri" inside the Tauri webview', () => {
    ;(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {}
    expect(activeClientKind()).toBe('tauri')
  })

  it('is "web" in a WebHID browser (and selectClient yields the wasm-backed RealXapClient)', () => {
    setHid(true)
    expect(activeClientKind()).toBe('web')
    expect(selectClient()).toBeInstanceOf(RealXapClient)
  })

  it('is "unsupported" in a non-WebHID browser (no silent mock fallback)', () => {
    setHid(false)
    expect(activeClientKind()).toBe('unsupported')
    // selectClient still yields a mock instance; App short-circuits the
    // unsupported case to a landing before rendering its fixture data.
    expect(selectClient()).toBeInstanceOf(MockXapClient)
  })

  it('localStorage["xap-client"]="mock" forces mock even when WebHID is available', () => {
    setHid(true)
    window.localStorage.setItem('xap-client', 'mock')
    expect(activeClientKind()).toBe('mock')
    expect(selectClient()).toBeInstanceOf(MockXapClient)
  })
})
