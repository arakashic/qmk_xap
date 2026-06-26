import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach } from 'vitest'
import { XapClientContext } from '@/queries/client-context'
import { MockXapClient } from '@/xap/mock/client'
import { useUiStore } from '@/store/ui'
import { TopBar } from './TopBar'
import type { DeviceSummary } from '@/xap/client'

function wrap(device: DeviceSummary | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <XapClientContext.Provider value={new MockXapClient()}>
        <TopBar device={device} />
      </XapClientContext.Provider>
    </QueryClientProvider>
  )
}

beforeEach(() => useUiStore.setState({ activeDeviceId: 'ugo_rev3_full' }))

it('renders a device-selector combobox showing the active device product', async () => {
  const device: DeviceSummary = { id: 'ugo_rev3_full', product: '[SIM] Protok Keyboard Model II Full Native Sim', manufacturer: 'x', secureStatus: 'Unlocked', status: 'ready' }
  render(wrap(device))
  expect(await screen.findByRole('combobox')).toBeInTheDocument()
  expect(screen.getByText(/Protok/)).toBeInTheDocument()
})
