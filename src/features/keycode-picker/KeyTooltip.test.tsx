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

  // Two failure modes guarded here: shadcn's stock bg-popover produces nothing
  // (no --popover token in this project) so the tooltip renders transparent,
  // and a light surface would blend into the white key caps behind it.
  it('paints an opaque dark surface distinct from the white key caps', async () => {
    renderTip({ key: 'KC_A', label: 'A' })

    fireEvent.focus(screen.getByRole('button', { name: 'cap' }))

    const tip = await waitFor(() => {
      const el = document.querySelector('[role="tooltip"]')
      if (!el) throw new Error('tooltip not open')
      return el
    })
    expect(tip.className).toContain('bg-[var(--rail)]')
    expect(tip.className).not.toContain('bg-popover')
    expect(tip.className).not.toContain('bg-background')
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
