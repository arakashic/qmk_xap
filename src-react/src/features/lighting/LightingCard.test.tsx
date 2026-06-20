import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { LightingCapabilities, RgbMatrixConfig, BacklightConfig } from '@/xap/types'
import { LightingCard } from './LightingCard'

const RGB_EFFECTS: LightingCapabilities = {
  effects: [
    { code: 1, key: 'SOLID_COLOR', group: null, label: 'Solid Color' },
    { code: 2, key: 'BREATHING', group: null, label: 'Breathing' },
  ],
  get_config_enabled: true,
  set_config_enabled: true,
  save_config_enabled: true,
}

const BL_EFFECTS: LightingCapabilities = {
  effects: [
    { code: 0, key: 'BREATHING', group: null, label: 'Breathing' },
  ],
  get_config_enabled: true,
  set_config_enabled: true,
  save_config_enabled: true,
}

const RGB_CONFIG: RgbMatrixConfig = {
  enable: 1,
  mode: 1,
  hue: 0,
  sat: 255,
  val: 200,
  speed: 128,
  flags: 0,
}

const BL_CONFIG: BacklightConfig = {
  enable: 1,
  mode: 0,
  val: 200,
}

describe('LightingCard (rgbmatrix)', () => {
  it('renders enable switch checked when enable=1', () => {
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={false}
        onPatch={vi.fn()}
        onSave={vi.fn()}
      />
    )
    const sw = screen.getByRole('switch')
    expect(sw).toBeChecked()
  })

  it('renders effect Select showing current mode label', () => {
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={false}
        onPatch={vi.fn()}
        onSave={vi.fn()}
      />
    )
    // The select trigger should show the current mode label
    expect(screen.getByText('Solid Color')).toBeInTheDocument()
  })

  it('renders HSV color swatch', () => {
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={false}
        onPatch={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /color/i })).toBeInTheDocument()
  })

  it('renders Speed slider and NOT a Brightness slider', () => {
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={false}
        onPatch={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByText('Speed')).toBeInTheDocument()
    expect(screen.queryByText('Bright')).not.toBeInTheDocument()
  })

  it('toggling switch from checked calls onPatch({enable:0})', () => {
    const onPatch = vi.fn()
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={false}
        onPatch={onPatch}
        onSave={vi.fn()}
      />
    )
    const sw = screen.getByRole('switch')
    fireEvent.click(sw)
    expect(onPatch).toHaveBeenCalledWith({ enable: 0 })
  })
})

describe('LightingCard (backlight)', () => {
  it('renders Brightness slider and NOT HSV swatch or Speed slider', () => {
    render(
      <LightingCard
        sub="backlight"
        caps={BL_EFFECTS}
        config={BL_CONFIG}
        dirty={false}
        onPatch={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByText('Bright')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /color/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Speed')).not.toBeInTheDocument()
  })
})

describe('LightingCard dirty/saved state', () => {
  it('when dirty: shows Save button + "not saved to EEPROM" text', () => {
    const onSave = vi.fn()
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={true}
        onPatch={vi.fn()}
        onSave={onSave}
      />
    )
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByText(/not saved to EEPROM/i)).toBeInTheDocument()
  })

  it('when dirty: clicking Save calls onSave', () => {
    const onSave = vi.fn()
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={true}
        onPatch={vi.fn()}
        onSave={onSave}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('when not dirty: shows "saved" text and no Save button', () => {
    render(
      <LightingCard
        sub="rgbmatrix"
        caps={RGB_EFFECTS}
        config={RGB_CONFIG}
        dirty={false}
        onPatch={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByText(/saved/i)).toBeInTheDocument()
    // The save button should not appear when not dirty
    // (the "saved" text above is the green checkmark indicator, not a button)
    const saveButton = screen.queryByRole('button', { name: /save/i })
    expect(saveButton).not.toBeInTheDocument()
  })
})
