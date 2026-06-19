import type { KeyCode } from '@/xap/types'
import { KeyCap } from '@/features/keymap/KeyCap'

// Picker cap size — slightly smaller than the legend specimen (58px)
const PICKER_W = 42
const PICKER_H = 34

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
