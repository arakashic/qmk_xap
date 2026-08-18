import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BasicKeyboardLayout } from './BasicKeyboardLayout'
import type { KeyboardLayoutDef } from './layouts/types'
import type { KeyCode } from '@/xap/types'

const DEF: KeyboardLayoutDef = {
  id: 't', label: 'T', width: 3, height: 1,
  keys: [
    { key: 'KC_A', x: 0, y: 0, w: 1, h: 1 },
    { key: 'KC_B', x: 1, y: 0, w: 1, h: 1 },
    { key: 'KC_HOME', x: 2, y: 0, w: 1, h: 1 },
  ],
}

it('renders matched keys as buttons and missing keys as ghosts; click calls onPick', () => {
  const codes: KeyCode[] = [{ key: 'KC_A', label: 'A' }, { key: 'KC_B', label: 'B' }]
  const onPick = vi.fn()
  render(
    <TooltipProvider delayDuration={0}>
      <BasicKeyboardLayout codes={codes} layout={DEF} onPick={onPick} />
    </TooltipProvider>,
  )
  expect(screen.getAllByTestId('layout-key')).toHaveLength(2)
  expect(screen.getAllByTestId('layout-ghost')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'KC_A' }))
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ key: 'KC_A' }))
})
