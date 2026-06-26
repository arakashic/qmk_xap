import { describe, it, expect } from 'vitest'
import { secureToggleLabel } from './secureToggle'

describe('secureToggleLabel', () => {
  it('Unlocked -> green LED, enabled, "click to lock"', () => {
    const v = secureToggleLabel('Unlocked')
    expect(v).toMatchObject({ label: 'Unlocked', disabled: false, color: '#16a34a' })
    expect(v.title).toMatch(/lock/i)
  })

  it('Locked -> dark-red LED, enabled, "click to unlock"', () => {
    const v = secureToggleLabel('Locked')
    expect(v).toMatchObject({ label: 'Locked', disabled: false, color: '#9b2c2c' })
    expect(v.title).toMatch(/unlock/i)
  })

  it('Unlocking -> orange LED, disabled', () => {
    const v = secureToggleLabel('Unlocking')
    expect(v).toMatchObject({ disabled: true, color: '#dd6b20' })
    expect(v.label).toMatch(/unlocking/i)
  })
})
