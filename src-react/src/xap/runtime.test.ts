import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock @tauri-apps/api/event so importing listen doesn't fail in jsdom
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

// Import after mocks are registered
const { selectClient } = await import('./runtime')
const { RealXapClient } = await import('./real-client')
const { MockXapClient } = await import('./mock/client')

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
})
