import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import App from '@/App'
import { XapClientContext } from '@/queries/client-context'
import { MockXapClient } from '@/xap/mock/client'
import { useUiStore } from '@/store/ui'

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ client, qc }: { client: MockXapClient; qc: QueryClient }) {
  return (
    <QueryClientProvider client={qc}>
      <XapClientContext.Provider value={client}>
        <App />
      </XapClientContext.Provider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useUiStore.setState({ activeDeviceId: null, selectedLayer: 0, route: 'keymap' })
  // jsdom has no navigator.hid, so the runtime would resolve to 'unsupported'
  // and App would render the unsupported landing. This test drives the injected
  // mock client, so put the runtime in the mock build kind explicitly.
  vi.stubEnv('VITE_MOCK', '1')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('DevicesPage routing', () => {
  it('clicking Devices rail item shows device products and hides DevtoolsStrip', async () => {
    const client = new MockXapClient()
    const qc = makeQc()

    render(<Wrapper client={client} qc={qc} />)

    // Click the Devices nav item in the rail (appears once devices load — the
    // first render shows the searching landing).
    const devicesButton = await screen.findByRole('button', { name: /devices/i })
    fireEvent.click(devicesButton)

    // Both device product names from the mock fixtures should appear
    await waitFor(() => {
      expect(
        screen.getByText(/Protok Keyboard Model II Full Native Sim/i),
      ).toBeInTheDocument()
      expect(screen.getByText(/Mini 40% Sim/i)).toBeInTheDocument()
    })

    // DevtoolsStrip must NOT be in the document on the Devices route
    expect(screen.queryByText(/devtools/i)).toBeNull()
  })

  it('KeymapPage route still shows DevtoolsStrip', async () => {
    const client = new MockXapClient()
    const qc = makeQc()

    render(<Wrapper client={client} qc={qc} />)

    // Default route is keymap — devtools strip should be present
    await waitFor(() => {
      expect(screen.getByText(/devtools/i)).toBeInTheDocument()
    })
  })
})
