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
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
    setHid(false)
    vi.unstubAllEnvs()
  })

  it('returns RealXapClient inside the Tauri webview', async () => {
    ;(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {}
    expect(await selectClient()).toBeInstanceOf(RealXapClient)
  })

  // Regression: the desktop adapter must subscribe on the SAME channel the Rust
  // backend emits on (`handle.emit("xap", ...)`). It previously listened on the
  // stale tauri-specta name 'xap-event', so no broadcast ever reached the UI.
  it('subscribes Tauri broadcasts on the "xap" channel (matches backend emit)', async () => {
    ;(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {}
    ;(await selectClient()).subscribe(() => {})
    expect(vi.mocked(listen)).toHaveBeenCalledWith('xap', expect.any(Function))
  })

  it('returns the mock client only when VITE_MOCK is set', async () => {
    vi.stubEnv('VITE_MOCK', '1')
    expect(await selectClient()).toBeInstanceOf(MockXapClient)
  })

  it('returns an inert client (not the mock) for a non-WebHID browser', async () => {
    setHid(false)
    const c = await selectClient()
    expect(c).not.toBeInstanceOf(MockXapClient)
    expect(c).not.toBeInstanceOf(RealXapClient)
    await expect(c.listDevices()).resolves.toEqual([])
    expect(typeof c.subscribe(() => {})).toBe('function')
  })
})

describe('activeClientKind', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']
    setHid(false)
    vi.unstubAllEnvs()
  })

  it('is "tauri" inside the Tauri webview', () => {
    ;(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {}
    expect(activeClientKind()).toBe('tauri')
  })

  it('is "mock" in a VITE_MOCK build', () => {
    vi.stubEnv('VITE_MOCK', '1')
    expect(activeClientKind()).toBe('mock')
  })

  it('is "web" in a WebHID browser (and selectClient yields the wasm-backed RealXapClient)', async () => {
    setHid(true)
    expect(activeClientKind()).toBe('web')
    expect(await selectClient()).toBeInstanceOf(RealXapClient)
  })

  it('is "unsupported" in a non-WebHID browser (no silent mock fallback)', () => {
    setHid(false)
    expect(activeClientKind()).toBe('unsupported')
  })
})
