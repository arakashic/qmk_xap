import type { KeyCode } from '@/xap/types'
import { KeyCap } from '@/features/keymap/KeyCap'
import { PICKER_CAP_W, PICKER_CAP_H } from './capSize'
import { KeyTooltip } from './KeyTooltip'

interface PickerKeyProps {
  code: KeyCode
  hovered?: boolean
  selected?: boolean
  onPick: (code: KeyCode) => void
}

export function PickerKey({ code, hovered, selected, onPick }: PickerKeyProps) {
  return (
    <KeyTooltip code={code}>
      <button
        type="button"
        onClick={() => onPick(code)}
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
        <KeyCap code={code} width={PICKER_CAP_W} height={PICKER_CAP_H} />
      </button>
    </KeyTooltip>
  )
}
