import { render as rtlRender, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect } from 'vitest'
import type { ReactElement } from 'react'
import type { DeviceSummary } from '@/xap/client'
import { DeviceLanding } from './DeviceLanding'

// DeviceLanding embeds ConnectDeviceButton, which calls useQueryClient().
const render = (ui: ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

const dev = (over: Partial<DeviceSummary>): DeviceSummary => ({
  id: 'd1', product: 'Keeb', manufacturer: '', secureStatus: 'Locked', status: 'connecting', ...over,
})

describe('DeviceLanding', () => {
  it('shows the searching state during first load / arrival window', () => {
    render(<DeviceLanding searching errored={false} pending={[]} failed={[]} />)
    expect(screen.getByText(/searching for keyboards/i)).toBeInTheDocument()
  })

  it('shows a connecting state with the device product when a handshake is in progress', () => {
    render(<DeviceLanding searching={false} errored={false} pending={[dev({ product: 'Ugo', status: 'interrogating' })]} failed={[]} />)
    expect(screen.getByText(/connecting to ugo/i)).toBeInTheDocument()
  })

  it('surfaces an interrogation failure with its error, not "No keyboard connected"', () => {
    render(<DeviceLanding searching={false} errored={false} pending={[]} failed={[dev({ product: 'Ugo', status: 'failed', error: 'timeout' })]} />)
    expect(screen.getByText(/could not connect to ugo/i)).toBeInTheDocument()
    expect(screen.getByText(/timeout/i)).toBeInTheDocument()
    expect(screen.queryByText(/no keyboard connected/i)).toBeNull()
  })

  it('shows the empty state when settled with no devices', () => {
    render(<DeviceLanding searching={false} errored={false} pending={[]} failed={[]} />)
    expect(screen.getByText(/no keyboard connected/i)).toBeInTheDocument()
  })

  it('shows a backend error distinctly from an empty list', () => {
    render(<DeviceLanding searching={false} errored pending={[]} failed={[]} />)
    expect(screen.getByText(/could not reach the backend/i)).toBeInTheDocument()
    expect(screen.queryByText(/no keyboard connected/i)).toBeNull()
  })

  it('shows an unsupported-browser message when WebHID is unavailable', () => {
    render(<DeviceLanding searching={false} errored={false} pending={[]} failed={[]} unsupported />)
    expect(screen.getByText(/does not support webhid/i)).toBeInTheDocument()
    expect(screen.queryByText(/no keyboard connected/i)).toBeNull()
  })
})
