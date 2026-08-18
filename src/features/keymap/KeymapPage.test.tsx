import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import { KeymapPage } from './KeymapPage'
import { XapClientContext } from '@/queries/client-context'
import { MockXapClient } from '@/xap/mock/client'
import { useUiStore } from '@/store/ui'
import { usePickerStore } from '@/store/picker'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function Wrapper({ client, qc }: { client: MockXapClient; qc: QueryClient }) {
  return (
    <QueryClientProvider client={qc}>
      <XapClientContext.Provider value={client}>
        <KeymapPage />
      </XapClientContext.Provider>
    </QueryClientProvider>
  )
}

// The ugo fixture device id
const DEVICE_ID = 'ugo_rev3_full'

beforeEach(() => {
  // Reset Zustand stores between tests
  useUiStore.setState({ activeDeviceId: null, selectedLayer: 0 })
  usePickerStore.setState({
    dockOpen: false,
    dockPinned: false,
    target: null,
    pending: null,
    hovered: null,
    activeTab: 'basic',
    query: '',
  })
})

// ── helper: wait for board to render ─────────────────────────────────────────

/** Wait for the board to appear (keymap query resolved). */
async function waitForBoard() {
  // KC_A renders as text "A" inside the first board button
  return waitFor(
    () => {
      const buttons = screen.getAllByRole('button')
      const found = buttons.find((b) => b.textContent === 'A')
      if (!found) throw new Error('board not rendered')
      return found
    },
    { timeout: 3000 },
  )
}

/** Wait for the picker catalog to expand with constants loaded. */
async function waitForPickerBasicKeys() {
  // Basic catalog renders a button with text "A" (among many others).
  // After dock open + constants load, there will be board + picker "A" buttons.
  return waitFor(
    () => {
      const buttons = screen.getAllByRole('button')
      const found = buttons.filter((b) => b.textContent === 'A')
      // board has 1 "A", picker should add more — but both may be exactly "A"
      // After expansion we need at least 1 (the picker one); the board A may also match.
      // Use: once picker is open, we can find buttons from the catalog by count > 1
      if (found.length < 2) throw new Error('picker catalog not yet rendered')
      return found
    },
    { timeout: 3000 },
  )
}

/** Find a board button by exact text content (no label fallback). */
function findBoardButton(text: string) {
  const buttons = screen.getAllByRole('button')
  return buttons.find((b) => b.textContent === text)
}

/** Get the first picker-catalog button with the given text (not a board button). */
async function waitForPickerButton(text: string) {
  return waitFor(() => {
    const buttons = screen.getAllByRole('button')
    const found = buttons.filter((b) => b.textContent === text)
    if (found.length === 0) throw new Error(`picker button "${text}" not found`)
    // Return the last one (board buttons tend to appear first)
    return found[found.length - 1]
  })
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('KeymapPage flow integration', () => {
  it('basic pick: one write, board reflects it, no pending', async () => {
    const client = new MockXapClient()
    const remapSpy = vi.spyOn(client, 'remapKey')
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    // Wait for the board (keymap loaded)
    const boardA = await waitForBoard()
    expect(boardA).toBeTruthy()

    // Click board KC_A: opens picker for (layer=0, row=3, col=3)
    fireEvent.click(boardA!)

    // Picker opens; wait for basic catalog (constants loaded)
    await waitForPickerBasicKeys()

    // activeTab is 'basic' by default; find "A" in picker catalog
    const pickerA = await waitForPickerButton('A')
    fireEvent.click(pickerA)

    // Exactly one write: target matches KC_A fixture position
    await waitFor(() => expect(remapSpy).toHaveBeenCalledTimes(1))
    const [, target, code] = remapSpy.mock.calls[0]
    expect(target).toEqual({ kind: 'key', layer: 0, row: 3, column: 3 })
    expect(code.key).toBe('KC_A')

    // No pending fill after a basic one-step pick
    expect(usePickerStore.getState().pending).toBeNull()
  })

  it('MT hold pick (hold Ctrl): no write, picker pending is set', async () => {
    const client = new MockXapClient()
    const remapSpy = vi.spyOn(client, 'remapKey')
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    const boardA = await waitForBoard()
    fireEvent.click(boardA!)

    // Wait for constants to load, then switch to modtap tab via store
    await waitForPickerBasicKeys()
    act(() => usePickerStore.getState().setTab('modtap'))

    // Now find the "hold Ctrl" button in the modtap catalog
    // PickerHoldKey renders: <span>"hold"</span><span>"Ctrl"</span>
    const ctrlHold = await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const found = buttons.find(
        (b) => b.textContent?.includes('hold') && b.textContent?.includes('Ctrl'),
      )
      if (!found) throw new Error('Ctrl hold button not found in modtap catalog')
      return found
    })

    fireEvent.click(ctrlHold)

    // No write fired — this is a two-step pick (tap hole still pending)
    expect(remapSpy).not.toHaveBeenCalled()

    // Pending is set: MT with mod_mask=0x01 (LCTL), hole='tap'
    const pending = usePickerStore.getState().pending
    expect(pending).not.toBeNull()
    expect(pending?.kind).toBe('MT')
    expect(pending?.fixed.mod_mask).toBe(0x01)
    expect(pending?.hole).toBe('tap')
  })

  it('MT hold pending + basic key: exactly one write with assembled LCTL_T code', async () => {
    const client = new MockXapClient()
    const remapSpy = vi.spyOn(client, 'remapKey')
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    const boardA = await waitForBoard()
    fireEvent.click(boardA!)

    // Set pending directly to simulate having picked "hold Ctrl" in step 1
    await waitForPickerBasicKeys()

    // Switch to modtap and pick Ctrl hold
    act(() => usePickerStore.getState().setTab('modtap'))
    const ctrlHold = await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const found = buttons.find(
        (b) => b.textContent?.includes('hold') && b.textContent?.includes('Ctrl'),
      )
      if (!found) throw new Error('Ctrl hold button not found')
      return found
    })
    fireEvent.click(ctrlHold)
    await waitFor(() => expect(usePickerStore.getState().pending).not.toBeNull())

    // After startFill, picker.setTab('basic') is called → activeTab should be 'basic'
    expect(usePickerStore.getState().activeTab).toBe('basic')

    // Now in basic tab: pick 'B' to complete the MT (any basic key works)
    const pickerB = await waitForPickerButton('B')
    fireEvent.click(pickerB)

    // Exactly one write with assembled MT code
    await waitFor(() => expect(remapSpy).toHaveBeenCalledTimes(1))
    const [, target, code] = remapSpy.mock.calls[0]
    expect(target).toEqual({ kind: 'key', layer: 0, row: 3, column: 3 })
    expect(code.key).toMatch(/MT\(/)
    expect(code.template?.kind).toBe('ModTap')
    expect((code.template as { kind: string; mod_mask: number }).mod_mask).toBe(0x01)

    // Pending cleared after write
    expect(usePickerStore.getState().pending).toBeNull()
  })

  it('MT hold pending + click another board key: no write, pending cleared', async () => {
    const client = new MockXapClient()
    const remapSpy = vi.spyOn(client, 'remapKey')
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    const boardA = await waitForBoard()
    fireEvent.click(boardA!)

    await waitForPickerBasicKeys()
    act(() => usePickerStore.getState().setTab('modtap'))

    const ctrlHold = await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const found = buttons.find(
        (b) => b.textContent?.includes('hold') && b.textContent?.includes('Ctrl'),
      )
      if (!found) throw new Error('Ctrl hold button not found')
      return found
    })
    fireEvent.click(ctrlHold)
    await waitFor(() => expect(usePickerStore.getState().pending).not.toBeNull())

    // Click the MO(1) board key while pending is set.
    // MO(1) renders as descriptor: "momentary" + "L1" text content.
    // The board button for MO(1) is found by its combined text content.
    const moButton = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('momentary') && b.textContent?.includes('L1'),
    )
    expect(moButton).toBeTruthy()
    fireEvent.click(moButton!)

    // No write: clicking another board key while pending = cancel, no write
    expect(remapSpy).not.toHaveBeenCalled()

    // Pending cleared by picker.open() (which is called for the new target)
    expect(usePickerStore.getState().pending).toBeNull()
    // New target is set (the MO key's position)
    expect(usePickerStore.getState().target).toEqual({ kind: 'key', layer: 0, row: 5, column: 0 })
  })

  it('Esc key on document cancels pending fill without a write', async () => {
    const client = new MockXapClient()
    const remapSpy = vi.spyOn(client, 'remapKey')
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    const boardA = await waitForBoard()
    fireEvent.click(boardA!)

    await waitForPickerBasicKeys()
    act(() => usePickerStore.getState().setTab('modtap'))

    const ctrlHold = await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const found = buttons.find(
        (b) => b.textContent?.includes('hold') && b.textContent?.includes('Ctrl'),
      )
      if (!found) throw new Error('Ctrl hold button not found')
      return found
    })
    fireEvent.click(ctrlHold)
    await waitFor(() => expect(usePickerStore.getState().pending).not.toBeNull())

    // Esc on document → document-level listener in KeymapPage cancels pending
    fireEvent.keyDown(document, { key: 'Escape' })

    // Pending cleared, no write
    expect(usePickerStore.getState().pending).toBeNull()
    expect(remapSpy).not.toHaveBeenCalled()
  })

  it('encoder target basic pick: writes via setEncoderKeycode, not remapKey', async () => {
    const client = new MockXapClient()
    const remapSpy = vi.spyOn(client, 'remapKey')
    const setEncSpy = vi.spyOn(client, 'setEncoderKeycode')
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    // Wait for the board to render so the component is mounted
    await waitForBoard()

    // Set the picker store target directly to an encoder target (EncoderRail not yet mounted)
    act(() =>
      usePickerStore.getState().open({
        kind: 'encoder',
        layer: 0,
        encoder: 0,
        clockwise: 1,
      }),
    )

    // Wait for picker catalog to load
    await waitForPickerBasicKeys()

    // Pick 'A' from the basic catalog
    const pickerA = await waitForPickerButton('A')
    fireEvent.click(pickerA)

    // setEncoderKeycode called once; remapKey not called
    await waitFor(() => expect(setEncSpy).toHaveBeenCalledTimes(1))
    expect(remapSpy).not.toHaveBeenCalled()

    // The write targeted the correct encoder slot
    const [, encTarget, code] = setEncSpy.mock.calls[0]
    expect(encTarget).toEqual({ kind: 'encoder', layer: 0, encoder: 0, clockwise: 1 })
    expect(code.key).toBe('KC_A')
  })

  it('encoder rail CW slot click → pick → setEncoderKeycode, not remapKey', async () => {
    const client = new MockXapClient()
    const remapSpy = vi.spyOn(client, 'remapKey')
    const setEncSpy = vi.spyOn(client, 'setEncoderKeycode')
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    // Wait for board and encoder rail to render (encoder query resolves alongside keymap)
    await waitForBoard()

    // The CW slot of encoder 0 in the fixture is KC_VOLU (label 'Vol+').
    // The Slot button text = '↻' + 'Vol+' + 'CW'
    const cwButton = await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const found = buttons.find(
        (b) => b.textContent?.includes('↻') && b.textContent?.includes('CW'),
      )
      if (!found) throw new Error('CW slot button not found in encoder rail')
      return found
    })

    // Click the CW slot — opens picker with encoder target
    fireEvent.click(cwButton)

    // Picker target should be the encoder CW slot
    expect(usePickerStore.getState().target).toEqual({
      kind: 'encoder',
      layer: 0,
      encoder: 0,
      clockwise: 1,
    })

    // Wait for basic catalog to render
    await waitForPickerBasicKeys()

    // Pick 'B' from the basic catalog
    const pickerB = await waitForPickerButton('B')
    fireEvent.click(pickerB)

    // Exactly one setEncoderKeycode write; remapKey not called
    await waitFor(() => expect(setEncSpy).toHaveBeenCalledTimes(1))
    expect(remapSpy).not.toHaveBeenCalled()

    // Correct target + code
    const [, encTarget, code] = setEncSpy.mock.calls[0]
    expect(encTarget).toEqual({ kind: 'encoder', layer: 0, encoder: 0, clockwise: 1 })
    expect(code.key).toBe('KC_B')

    // Mock client state updated — encoder 0 CW now KC_B
    const encoderMap = await client.getEncoderKeymap(DEVICE_ID)
    expect(encoderMap[0][0].cw.key).toBe('KC_B')
  })

  it('clicking empty space clears the selection and closes an unpinned dock', async () => {
    const client = new MockXapClient()
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    const boardA = await waitForBoard()
    fireEvent.click(boardA!)
    expect(usePickerStore.getState().target).not.toBeNull()
    expect(usePickerStore.getState().dockOpen).toBe(true)

    fireEvent.click(screen.getByTestId('keymap-region'))

    expect(usePickerStore.getState().target).toBeNull()
    expect(usePickerStore.getState().pending).toBeNull()
    expect(usePickerStore.getState().dockOpen).toBe(false)
  })

  it('clicking empty space with a pinned dock clears the selection but keeps it open', async () => {
    const client = new MockXapClient()
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    const boardA = await waitForBoard()
    fireEvent.click(boardA!)
    act(() => { usePickerStore.setState({ dockPinned: true }) })

    fireEvent.click(screen.getByTestId('keymap-region'))

    expect(usePickerStore.getState().target).toBeNull()
    expect(usePickerStore.getState().dockOpen).toBe(true)
  })

  it('clicking a board key does not deselect it', async () => {
    const client = new MockXapClient()
    const qc = makeQc()

    useUiStore.setState({ activeDeviceId: DEVICE_ID, selectedLayer: 0 })
    render(<Wrapper client={client} qc={qc} />)

    const boardA = await waitForBoard()
    fireEvent.click(boardA!)

    // The click bubbles to the keymap region; the button guard must swallow it.
    expect(usePickerStore.getState().target).not.toBeNull()
  })
})
