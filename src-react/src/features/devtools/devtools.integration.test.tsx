import { renderHook, act } from '@testing-library/react'
import { beforeEach, it, expect } from 'vitest'
import { useDevtoolsStore, devtoolsSink } from '../../store/devtools'
import { useUiStore } from '../../store/ui'
import { MockXapClient } from '../../xap/mock/client'
import { instrumentClient } from '../../xap/instrument'
import { XapClientContext } from '../../queries/client-context'
import { useDevtoolsSubscription } from './useDevtoolsSubscription'
import type { XapClient } from '../../xap/client'
import React from 'react'

beforeEach(() => {
  useDevtoolsStore.setState({
    entries: [],
    dockOpen: false,
    paused: false,
    hidden: [],
  })
  useUiStore.setState({ route: 'keymap', activeDeviceId: null })
})

function makeWrapper(client: XapClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <XapClientContext.Provider value={client}>
        {children}
      </XapClientContext.Provider>
    )
  }
}

it('remapKey produces a resolved call entry + a log broadcast entry', async () => {
  const mock = new MockXapClient()
  const client = instrumentClient(mock, devtoolsSink)

  // Mount the subscription hook with the instrumented client as context
  renderHook(() => useDevtoolsSubscription(), {
    wrapper: makeWrapper(client),
  })

  // Trigger a remapKey on a valid fixture coordinate: layer=0, row=3, col=3 (KC_A)
  await act(async () => {
    await client.remapKey('ugo_rev3_full', { layer: 0, row: 3, column: 3 }, {
      code: 5,
      key: 'KC_B',
      label: 'B',
    })
  })

  const { entries } = useDevtoolsStore.getState()

  // Should have at least one 'call' entry for remapKey
  const callEntry = entries.find((e) => e.kind === 'call' && e.label.includes('remapKey'))
  expect(callEntry).toBeDefined()
  expect(callEntry?.status).toBe('ok')
  expect(callEntry?.latencyMs).toBeTypeOf('number')

  // Should have at least one 'log' entry from the mock emit
  const logEntry = entries.find((e) => e.kind === 'log')
  expect(logEntry).toBeDefined()
  expect(logEntry?.label).toContain('remap')
})
