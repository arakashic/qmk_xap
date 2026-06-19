import type { KeyCode } from '@/xap/types'
import { legendOf } from '@/features/keymap/legend'

// ---- Slot: renders a single CCW or CW direction chip -----------------------

interface SlotProps {
  code: KeyCode
  direction: 'ccw' | 'cw'
  isSelected: boolean
  isPending: boolean
  onClick: () => void
}

function slotLabel(direction: 'ccw' | 'cw') {
  return direction === 'ccw' ? 'CCW' : 'CW'
}

function slotArrow(direction: 'ccw' | 'cw') {
  return direction === 'ccw' ? '↺' : '↻'
}

/** Renders the short display text for a KeyCode using the legend system. */
function slotDisplay(code: KeyCode): string {
  const leg = legendOf(code)
  switch (leg.kind) {
    case 'basic':      return leg.label
    case 'split':      return leg.tap
    case 'descriptor': return leg.payload
    case 'prefix':     return leg.payload
    case 'modified':   return leg.output
    case 'trns':       return '▽'
    case 'no':         return '—'
    case 'hex':        return `0x${leg.code.toString(16).toUpperCase().padStart(4, '0')}`
  }
}

function Slot({ code, direction, isSelected, isPending, onClick }: SlotProps) {
  // Pending: dashed amber "?" hole treatment — replicates KeyCap holeZone dashed style
  const valContent = isPending
    ? (
        <span
          data-testid="hole-zone"
          style={{
            border: '1px dashed #d69e2e',
            borderRadius: 3,
            padding: '0 5px',
            fontSize: 9,
            background: '#fffbea',
            color: '#b7791f',
          }}
        >
          ?
        </span>
      )
    : slotDisplay(code)

  const valStyle: React.CSSProperties = {
    border: isSelected ? '2px solid #d69e2e' : '1px solid hsl(var(--border))',
    borderRadius: 'calc(var(--radius) - 3px)',
    padding: '3px 7px',
    fontSize: 10,
    fontWeight: 600,
    color: '#1e3a8a',
    background: isSelected ? '#fefcbf' : '#fbfdff',
    marginTop: 2,
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontSize: 8,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 13, color: '#64748b', lineHeight: 1 }}>{slotArrow(direction)}</span>
      <span style={valStyle}>{valContent}</span>
      <span style={{ fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', marginTop: 2 }}>
        {slotLabel(direction)}
      </span>
    </button>
  )
}

// ---- EncoderKnob -----------------------------------------------------------

export interface EncoderKnobProps {
  index: number
  ccw: KeyCode
  cw: KeyCode
  selectedSlot?: 'ccw' | 'cw'
  pendingSlot?: 'ccw' | 'cw'
  onSelectSlot: (clockwise: number) => void
}

export function EncoderKnob({ index, ccw, cw, selectedSlot, pendingSlot, onSelectSlot }: EncoderKnobProps) {
  // Knob circle: selected => amber ring
  const knobStyle: React.CSSProperties = {
    width: 54,
    height: 54,
    borderRadius: '50%',
    border: '3px solid #94a3b8',
    background: 'radial-gradient(circle at 50% 38%, #fff, #eef2f7)',
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgb(0 0 0 / .12)',
  }

  // Pointer notch: a small pill at the top center of the knob
  const notchStyle: React.CSSProperties = {
    position: 'absolute',
    top: 3,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 3,
    height: 9,
    borderRadius: 2,
    background: '#64748b',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Slot
        code={ccw}
        direction="ccw"
        isSelected={selectedSlot === 'ccw'}
        isPending={pendingSlot === 'ccw'}
        onClick={() => onSelectSlot(0)}
      />
      <div style={knobStyle}>
        <span style={notchStyle} />
        <span style={{ fontSize: 8, color: '#94a3b8' }}>{`enc ${index}`}</span>
      </div>
      <Slot
        code={cw}
        direction="cw"
        isSelected={selectedSlot === 'cw'}
        isPending={pendingSlot === 'cw'}
        onClick={() => onSelectSlot(1)}
      />
    </div>
  )
}
