import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { XapClientContext } from '@/queries/client-context'
import { MockXapClient } from '@/xap/mock/client'
import { ugoState, miniState } from '@/xap/mock/fixtures'
import { DeviceCard } from './DeviceCard'
import type { XapDeviceState } from '@/xap/types'

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function Wrapper({ client, qc, children }: { client: MockXapClient; qc: QueryClient; children: React.ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <XapClientContext.Provider value={client}>
        {children}
      </XapClientContext.Provider>
    </QueryClientProvider>
  )
}

function renderCard(state: XapDeviceState, isActive: boolean, client: MockXapClient, qc: QueryClient) {
  return render(
    <Wrapper client={client} qc={qc}>
      <DeviceCard state={state} isActive={isActive} onSetActive={vi.fn()} />
    </Wrapper>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DeviceCard — INACTIVE card', () => {
  it('shows Firmware config and Set active only (no secure toggle, no danger buttons)', () => {
    const client = new MockXapClient()
    const qc = makeQc()
    renderCard(miniState, false, client, qc)

    expect(screen.getByRole('button', { name: /firmware config/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set active/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /locked|unlocked|unlocking/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /bootloader/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /eeprom/i })).toBeNull()
  })
})

describe('DeviceCard — ACTIVE card, Locked', () => {
  it('secure toggle reads "Locked"; both danger buttons are disabled', () => {
    // miniState: secure_status = 'Locked', jump_to_bootloader_enabled = true, eeprom_reset_enabled = false
    const lockedUgo: XapDeviceState = { ...ugoState, secure_status: 'Locked' }
    const client = new MockXapClient()
    const qc = makeQc()
    renderCard(lockedUgo, true, client, qc)

    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bootloader/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /eeprom/i })).toBeDisabled()
  })
})

describe('DeviceCard — ACTIVE card, Unlocked (ugoState: both flags true)', () => {
  it('Jump to bootloader is enabled; Reset EEPROM is enabled for ugoState', () => {
    // ugoState: secure_status = 'Unlocked', jump_to_bootloader_enabled = true, eeprom_reset_enabled = true
    const client = new MockXapClient()
    const qc = makeQc()
    renderCard(ugoState, true, client, qc)

    expect(screen.getByRole('button', { name: /unlocked/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bootloader/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /eeprom/i })).not.toBeDisabled()
  })

  it('Reset EEPROM is disabled for miniState (eeprom_reset_enabled=false) even when unlocked', () => {
    const unlockedMini: XapDeviceState = { ...miniState, secure_status: 'Unlocked' }
    const client = new MockXapClient()
    const qc = makeQc()
    renderCard(unlockedMini, true, client, qc)

    expect(screen.getByRole('button', { name: /bootloader/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /eeprom/i })).toBeDisabled()
  })
})

describe('DeviceCard — danger confirm dialog', () => {
  it('clicking Jump to bootloader opens confirm dialog; confirming calls jumpToBootloader once', async () => {
    const client = new MockXapClient()
    vi.spyOn(client, 'jumpToBootloader')
    const qc = makeQc()
    renderCard(ugoState, true, client, qc)

    // Click the danger button
    fireEvent.click(screen.getByRole('button', { name: /bootloader/i }))

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Click confirm
    const dialog = screen.getByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(client.jumpToBootloader).toHaveBeenCalledTimes(1)
      expect(client.jumpToBootloader).toHaveBeenCalledWith(ugoState.id)
    })
  })

  it('clicking Reset EEPROM opens confirm dialog; confirming calls reinitializeEeprom once', async () => {
    const client = new MockXapClient()
    vi.spyOn(client, 'reinitializeEeprom')
    const qc = makeQc()
    renderCard(ugoState, true, client, qc)

    fireEvent.click(screen.getByRole('button', { name: /eeprom/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(client.reinitializeEeprom).toHaveBeenCalledTimes(1)
      expect(client.reinitializeEeprom).toHaveBeenCalledWith(ugoState.id)
    })
  })

  it('cancelling the danger dialog calls nothing', async () => {
    const client = new MockXapClient()
    vi.spyOn(client, 'jumpToBootloader')
    const qc = makeQc()
    renderCard(ugoState, true, client, qc)

    fireEvent.click(screen.getByRole('button', { name: /bootloader/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    const cancelBtn = within(dialog).getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)

    // Dialog should close, mutation not called
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(client.jumpToBootloader).not.toHaveBeenCalled()
  })
})
