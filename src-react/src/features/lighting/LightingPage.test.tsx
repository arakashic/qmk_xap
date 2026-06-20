import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { XapClientContext } from '@/queries/client-context'
import { MockXapClient } from '@/xap/mock/client'
import { useUiStore } from '@/store/ui'
import { LightingPage } from './LightingPage'

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ client, qc }: { client: MockXapClient; qc: QueryClient }) {
  return (
    <QueryClientProvider client={qc}>
      <XapClientContext.Provider value={client}>
        <LightingPage />
      </XapClientContext.Provider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useUiStore.setState({ activeDeviceId: null, selectedLayer: 0, route: 'lighting' })
})

describe('LightingPage — ugo (has all three subsystems)', () => {
  it('renders three cards with the expected titles', async () => {
    const client = new MockXapClient()
    const qc = makeQc()
    useUiStore.getState().setActiveDevice('ugo_rev3_full')

    render(<Wrapper client={client} qc={qc} />)

    await screen.findByText('Per-key RGB')
    await screen.findByText('Underglow')
    await screen.findByText('Backlight')
  })
})

describe('LightingPage — mini (no lighting)', () => {
  it('renders the "no lighting subsystems" message and zero cards', async () => {
    const client = new MockXapClient()
    const qc = makeQc()
    useUiStore.getState().setActiveDevice('mini40_locked')

    render(<Wrapper client={client} qc={qc} />)

    await screen.findByText('This device reports no lighting subsystems.')

    expect(screen.queryByText('Per-key RGB')).toBeNull()
    expect(screen.queryByText('Underglow')).toBeNull()
    expect(screen.queryByText('Backlight')).toBeNull()
  })
})

describe('LightingPage — auto-apply and save', () => {
  it('toggling the Per-key RGB enable switch calls setLightingConfig (auto-apply)', async () => {
    const client = new MockXapClient()
    const setSpy = vi.spyOn(client, 'setLightingConfig')
    const qc = makeQc()
    useUiStore.getState().setActiveDevice('ugo_rev3_full')

    render(<Wrapper client={client} qc={qc} />)

    // Wait for card to appear
    await screen.findByText('Per-key RGB')

    // The Per-key RGB card is the first card — get its switch
    const switches = screen.getAllByRole('switch')
    // rgbmatrix is first in the order ['backlight','rgblight','rgbmatrix']... wait:
    // order rendered is ['backlight','rgblight','rgbmatrix'] filtered by lighting[sub] non-null.
    // All three present. backlight switch = index 0 (enable=0, unchecked),
    // rgblight = index 1 (enable=1, checked), rgbmatrix = index 2 (enable=1, checked).
    // Let's find the Per-key RGB card's switch by heading proximity.
    // Simpler: find the first *checked* switch to toggle off for rgbmatrix.
    // Actually the brief says toggle Per-key RGB (rgbmatrix) enable switch.
    // rgbmatrix has enable=1. backlight has enable=0.
    // Order of rendering: backlight(enable=0), rgblight(enable=1), rgbmatrix(enable=1).
    // Switches: [backlight-off, rgblight-on, rgbmatrix-on] → index 2 is rgbmatrix.
    const rgbmatrixSwitch = switches[2]
    fireEvent.click(rgbmatrixSwitch)

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith(
        'ugo_rev3_full',
        'rgbmatrix',
        expect.objectContaining({ enable: 0 }),
      )
    })
  })

  it('after a change makes a card dirty, clicking Save invokes saveLightingConfig and clears dirty', async () => {
    const client = new MockXapClient()
    const saveSpy = vi.spyOn(client, 'saveLightingConfig')
    const qc = makeQc()
    useUiStore.getState().setActiveDevice('ugo_rev3_full')

    render(<Wrapper client={client} qc={qc} />)

    await screen.findByText('Per-key RGB')

    // Toggle rgbmatrix switch to make it dirty
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[2])

    // Wait for the dirty pill to appear
    await waitFor(() => {
      expect(screen.getAllByText(/not saved to EEPROM/).length).toBeGreaterThan(0)
    })

    // Click the Save button for the dirty card
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith('ugo_rev3_full', 'rgbmatrix')
    })

    // After save, dirty pill should clear
    await waitFor(() => {
      expect(screen.queryAllByText(/not saved to EEPROM/).length).toBe(0)
    })
  })
})
