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

describe('LightingPage — present-but-all-null lighting (real firmware shape)', () => {
  it('shows the empty message when info.lighting is an object with every subsystem null', async () => {
    // Real firmware returns info.lighting as a populated object whose members
    // are all null for a board with no lighting (not a plain null like the mock).
    const base = new MockXapClient()
    const full = await base.getDeviceState('ugo_rev3_full')
    const state = { ...full, info: { ...full.info!, lighting: { backlight: null, rgblight: null, rgbmatrix: null } } }
    const client = { getDeviceState: async () => state } as unknown as MockXapClient
    const qc = makeQc()
    useUiStore.getState().setActiveDevice('ugo_rev3_full')

    render(<Wrapper client={client} qc={qc} />)

    await screen.findByText('This device reports no lighting subsystems.')
    expect(screen.queryByText('Per-key RGB')).toBeNull()
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

describe('LightingPage — dirty flag survives refetch', () => {
  it('an applied-but-unsaved change stays dirty across a window-focus refetch', async () => {
    const client = new MockXapClient()
    const qc = makeQc()
    useUiStore.getState().setActiveDevice('ugo_rev3_full')

    render(<Wrapper client={client} qc={qc} />)

    await screen.findByText('Per-key RGB')

    // Make rgbmatrix dirty by toggling its switch off (enable 1 -> 0).
    // Auto-apply writes the RAM value to the mock, so a refetch returns enable=0.
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[2])

    await waitFor(() => {
      expect(screen.getAllByText(/not saved to EEPROM/).length).toBeGreaterThan(0)
    })

    // Simulate a window-focus refetch — getLightingConfig returns the RAM-applied value.
    await qc.refetchQueries({ queryKey: ['lighting', 'ugo_rev3_full', 'rgbmatrix'] })

    // The dirty bit must survive: still "not saved", NOT silently flipped to "✓ saved".
    await waitFor(() => {
      expect(screen.getAllByText(/not saved to EEPROM/).length).toBeGreaterThan(0)
    })
    // The rgbmatrix card must not show the saved indicator while dirty.
    // (backlight + rgblight are still clean and show "✓ saved"; rgbmatrix must not.)
    expect(screen.getAllByText(/✓\s*saved/).length).toBe(2)
  })

  it('Save clears dirty to ✓ saved without reverting the applied value', async () => {
    const client = new MockXapClient()
    const qc = makeQc()
    useUiStore.getState().setActiveDevice('ugo_rev3_full')

    render(<Wrapper client={client} qc={qc} />)

    await screen.findByText('Per-key RGB')

    // Toggle rgbmatrix off (enable 1 -> 0), making it dirty.
    const switches = screen.getAllByRole('switch')
    expect(switches[2]).toBeChecked()
    fireEvent.click(switches[2])

    await waitFor(() => {
      expect(screen.getAllByText(/not saved to EEPROM/).length).toBeGreaterThan(0)
    })

    // The applied (edited) switch state is reflected immediately.
    expect(screen.getAllByRole('switch')[2]).not.toBeChecked()

    // Save the rgbmatrix card.
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    fireEvent.click(saveButtons[0])

    // Dirty clears; all three cards now show "✓ saved".
    await waitFor(() => {
      expect(screen.queryAllByText(/not saved to EEPROM/).length).toBe(0)
      expect(screen.getAllByText(/✓\s*saved/).length).toBe(3)
    })

    // The edited value must NOT have reverted — switch is still off after save + invalidation.
    await waitFor(() => {
      expect(screen.getAllByRole('switch')[2]).not.toBeChecked()
    })
  })
})
