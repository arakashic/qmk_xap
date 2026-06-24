import type { KeyCode } from '@/xap/types'
import { KeyCap } from '@/features/keymap/KeyCap'

// Picker cap size — large enough for the KeyCap legend fonts (tuned for ~58px
// caps) so split/descriptor legends don't clip. Was 42x34 (clipped).
const PICKER_W = 54
const PICKER_H = 48

interface PickerKeyProps {
  code: KeyCode
  hovered?: boolean
  selected?: boolean
  onPick: (code: KeyCode) => void
  onHover: (code: KeyCode | null) => void
}

export function PickerKey({ code, hovered, selected, onPick, onHover }: PickerKeyProps) {
  return (
    <button
      type="button"
      onClick={() => onPick(code)}
      onMouseEnter={() => onHover(code)}
      onMouseLeave={() => onHover(null)}
      style={{
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        outline: hovered || selected ? '2px solid hsl(var(--primary))' : 'none',
        outlineOffset: 1,
        borderRadius: 'var(--key-radius)',
      }}
      aria-pressed={selected}
    >
      <KeyCap code={code} width={PICKER_W} height={PICKER_H} />
    </button>
  )
}
