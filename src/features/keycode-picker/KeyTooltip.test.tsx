import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { KeyTooltip } from './KeyTooltip'

function renderTip(code: Parameters<typeof KeyTooltip>[0]['code']) {
  return render(
    <TooltipProvider delayDuration={0}>
      <KeyTooltip code={code}>
        <button type="button">cap</button>
      </KeyTooltip>
    </TooltipProvider>,
  )
}

describe('KeyTooltip', () => {
  it('shows the key name and description on hover', async () => {
    renderTip({ key: 'KC_BACKSPACE', label: 'Backspace', description: 'Delete (Backspace)' })

    fireEvent.focus(screen.getByRole('button', { name: 'cap' }))

    await waitFor(() => {
      expect(screen.getAllByText('KC_BACKSPACE').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Delete (Backspace)').length).toBeGreaterThan(0)
    })
  })

  it('falls back to the label when there is no description', async () => {
    renderTip({ key: 'KC_A', label: 'A' })

    fireEvent.focus(screen.getByRole('button', { name: 'cap' }))

    await waitFor(() => {
      expect(screen.getAllByText('KC_A').length).toBeGreaterThan(0)
      expect(screen.getAllByText('A').length).toBeGreaterThan(0)
    })
  })
})
