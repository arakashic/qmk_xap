import type { XapSecureStatus } from '@/xap/types'

export interface SecureToggleView {
  /** Short state word shown on the button (matches the design's dot + word). */
  label: string
  /** Tooltip describing the click action. */
  title: string
  /** True while mid-transition (Unlocking) — the control is non-interactive. */
  disabled: boolean
  /** Per-state accent / LED color: green unlocked, dark-red locked, orange unlocking. */
  color: string
}

/** View model for the secure-status toggle (label + tooltip + disabled + LED color). */
export function secureToggleLabel(status: XapSecureStatus): SecureToggleView {
  if (status === 'Unlocked') return { label: 'Unlocked', title: 'Click to lock', disabled: false, color: '#16a34a' }
  if (status === 'Unlocking') return { label: 'Unlocking…', title: 'Unlocking — complete the hold sequence on the keyboard', disabled: true, color: '#dd6b20' }
  return { label: 'Locked', title: 'Click to unlock', disabled: false, color: '#9b2c2c' }
}
