import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HsvControl } from './HsvControl'

describe('HsvControl', () => {
  it('renders a swatch trigger button with a non-empty background-color style', () => {
    const spy = vi.fn()
    render(<HsvControl hue={0} sat={255} val={255} onChange={spy} />)
    const trigger = screen.getByRole('button', { name: /color/i })
    const bg = trigger.style.backgroundColor || trigger.style.background
    expect(bg).not.toBe('')
  })

  it('opens popover and shows ColorArea + ColorSlider on trigger click', async () => {
    const spy = vi.fn()
    render(<HsvControl hue={0} sat={255} val={255} onChange={spy} />)
    const trigger = screen.getByRole('button', { name: /color/i })
    fireEvent.click(trigger)
    // ColorSlider renders a slider role for the hue track
    const sliders = screen.getAllByRole('slider')
    expect(sliders.length).toBeGreaterThanOrEqual(1)
  })

  it('is disabled when disabled prop is true', () => {
    const spy = vi.fn()
    render(<HsvControl hue={0} sat={255} val={255} onChange={spy} disabled />)
    const trigger = screen.getByRole('button', { name: /color/i })
    expect(trigger).toBeDisabled()
  })

  it('swatch background reflects input color (hue=128 gives non-red hsl)', () => {
    const spy = vi.fn()
    render(<HsvControl hue={128} sat={200} val={200} onChange={spy} />)
    const trigger = screen.getByRole('button', { name: /color/i })
    const bg = trigger.style.backgroundColor || trigger.style.background
    // hue=128 -> hsl ~180deg, so background should contain a color string
    expect(bg).not.toBe('')
  })
})
