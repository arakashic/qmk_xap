import type { XapSecureStatus } from '@/xap/types'

/** Label and disabled state for the secure toggle button. */
export function secureToggleLabel(status: XapSecureStatus): { label: string; disabled: boolean } {
  if (status === 'Unlocked') return { label: 'Unlocked, click to lock', disabled: false }
  if (status === 'Unlocking') return { label: 'Unlocking…', disabled: true }
  return { label: 'Locked, click to unlock', disabled: false }
}
