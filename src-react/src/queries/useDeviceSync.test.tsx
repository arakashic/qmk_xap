import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { XapClientContext } from './client-context'
import type { XapClient } from '@/xap/client'
import type { XapEvent } from '@/xap/types'
import { useDeviceSync } from './useDeviceSync'

// Minimal fake client: captures the subscribed handler so the test can push events.
function fakeClient() {
  let handler: ((e: XapEvent) => void) | null = null
  const client = {
    subscribe(h: (e: XapEvent) => void) {
      handler = h
      return () => { handler = null }
    },
  } as unknown as XapClient
  return { client, emit: (e: XapEvent) => handler?.(e) }
}

function setup() {
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const { client, emit } = fakeClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <XapClientContext.Provider value={client}>{children}</XapClientContext.Provider>
    </QueryClientProvider>
  )
  renderHook(() => useDeviceSync(), { wrapper })
  return { emit, spy }
}

describe('useDeviceSync', () => {
  it('invalidates the devices query when a NewDevice event arrives', () => {
    const { emit, spy } = setup()
    emit({ kind: 'NewDevice', data: { id: 'dev1' } })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['devices'] })
  })

  it('invalidates the devices query when a RemovedDevice event arrives', () => {
    const { emit, spy } = setup()
    emit({ kind: 'RemovedDevice', data: { id: 'dev1' } })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['devices'] })
  })

  it('ignores unrelated events', () => {
    const { emit, spy } = setup()
    emit({ kind: 'LogReceived', data: { id: 'dev1', log: 'hi' } })
    expect(spy).not.toHaveBeenCalled()
  })
})
