import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { XapClientContext } from './client-context'
import type { XapClient } from '@/xap/client'
import type { MappedKeymap, KeyCode } from '@/xap/types'
import { useRemapKey } from './keymap'

const KEY = ['keymap', 'dev']

// Minimal one-key keymap; only the fields applyRemap touches matter.
function seedKeymap(): MappedKeymap {
  return {
    keys: [[[{ layout: { matrix: { x: 0, y: 0 }, x: 0, y: 0, w: 1, h: 1 }, key: { code: { key: 'KC_A' } } }]]],
  } as unknown as MappedKeymap
}

function codeAt(qc: QueryClient): string | undefined {
  const km = qc.getQueryData<MappedKeymap>(KEY)
  return km?.keys[0][0][0]?.key.code.key
}

function setup(remapKey: XapClient['remapKey']) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  qc.setQueryData(KEY, seedKeymap())
  const client = { remapKey } as unknown as XapClient
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <XapClientContext.Provider value={client}>{children}</XapClientContext.Provider>
    </QueryClientProvider>
  )
  const { result } = renderHook(() => useRemapKey('dev'), { wrapper })
  return { qc, result }
}

const target = { layer: 0, row: 0, column: 0 }
const code: KeyCode = { key: 'KC_B' }

describe('useRemapKey optimistic update', () => {
  it('applies the new keycode to the cache on success', async () => {
    const { qc, result } = setup(vi.fn().mockResolvedValue(undefined))
    await act(async () => { await result.current.mutateAsync({ target, code }) })
    expect(codeAt(qc)).toBe('KC_B')
  })

  it('rolls the cache back to the previous keycode when the write fails', async () => {
    const { qc, result } = setup(vi.fn().mockRejectedValue(new Error('device error')))
    await act(async () => {
      await result.current.mutateAsync({ target, code }).catch(() => {})
    })
    expect(codeAt(qc)).toBe('KC_A')
  })
})
