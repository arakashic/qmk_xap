import type { EncoderSlots } from '@/xap/client'
import type { PickerTarget, PendingFill } from '@/features/keycode-picker/templateFill'
import { EncoderKnob } from './EncoderKnob'

export interface EncoderRailProps {
  encoders: EncoderSlots[]
  selectedTarget: PickerTarget | null
  pendingFill: PendingFill | null
  onSelectSlot: (encoder: number, clockwise: number) => void
}

export function EncoderRail({ encoders, selectedTarget, pendingFill, onSelectSlot }: EncoderRailProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 26,
        padding: '16px 18px',
        justifyContent: 'center',
        borderTop: '1px dashed hsl(var(--border))',
        flexWrap: 'wrap',
      }}
    >
      {encoders.map((enc, i) => {
        // selectedTarget maps to knob slot
        let selectedSlot: 'ccw' | 'cw' | undefined
        if (selectedTarget?.kind === 'encoder' && selectedTarget.encoder === i) {
          selectedSlot = selectedTarget.clockwise ? 'cw' : 'ccw'
        }

        // pendingFill maps to knob slot
        let pendingSlot: 'ccw' | 'cw' | undefined
        if (pendingFill?.target.kind === 'encoder' && pendingFill.target.encoder === i) {
          pendingSlot = pendingFill.target.clockwise ? 'cw' : 'ccw'
        }

        return (
          <EncoderKnob
            key={i}
            index={i}
            ccw={enc.ccw}
            cw={enc.cw}
            selectedSlot={selectedSlot}
            pendingSlot={pendingSlot}
            onSelectSlot={(clockwise) => onSelectSlot(i, clockwise)}
          />
        )
      })}
    </div>
  )
}
