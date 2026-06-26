import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EncoderRail } from './EncoderRail'
import type { EncoderSlots } from '@/xap/client'

const THREE_ENCODERS: EncoderSlots[] = [
  { ccw: { key: 'KC_VOLD', label: 'Vol-' }, cw: { key: 'KC_VOLU', label: 'Vol+' } },
  { ccw: { key: 'KC_MPRV', label: 'Prev' }, cw: { key: 'KC_MNXT', label: 'Next' } },
  { ccw: { key: 'KC_TRNS', label: '▽' },    cw: { key: 'KC_TRNS', label: '▽' } },
]

describe('EncoderRail', () => {
  it('renders 3 knobs for 3 encoders', () => {
    render(
      <EncoderRail
        layer={0}
        encoders={THREE_ENCODERS}
        selectedTarget={null}
        pendingFill={null}
        onSelectSlot={() => {}}
      />,
    )
    // Each knob shows "enc N"
    expect(screen.getByText('enc 0')).toBeTruthy()
    expect(screen.getByText('enc 1')).toBeTruthy()
    expect(screen.getByText('enc 2')).toBeTruthy()
  })

  it('CCW and CW labels are present for all 3 knobs', () => {
    render(
      <EncoderRail
        layer={0}
        encoders={THREE_ENCODERS}
        selectedTarget={null}
        pendingFill={null}
        onSelectSlot={() => {}}
      />,
    )
    const ccwLabels = screen.getAllByText('CCW')
    const cwLabels  = screen.getAllByText('CW')
    expect(ccwLabels).toHaveLength(3)
    expect(cwLabels).toHaveLength(3)
  })

  it('renders CCW arrow ↺ and CW arrow ↻ for each knob', () => {
    render(
      <EncoderRail
        layer={0}
        encoders={THREE_ENCODERS}
        selectedTarget={null}
        pendingFill={null}
        onSelectSlot={() => {}}
      />,
    )
    expect(screen.getAllByText('↺')).toHaveLength(3)
    expect(screen.getAllByText('↻')).toHaveLength(3)
  })

  it('does not highlight a slot when selectedTarget layer differs from rail layer', () => {
    // Target is on layer 0, enc 0, CW — but rail is rendering layer 1.
    // The CW button for enc 0 must NOT be marked selected.
    render(
      <EncoderRail
        layer={1}
        encoders={THREE_ENCODERS}
        selectedTarget={{ kind: 'encoder', layer: 0, encoder: 0, clockwise: 1 }}
        pendingFill={null}
        onSelectSlot={() => {}}
      />,
    )
    // All slot buttons must have no data-selected attribute
    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn.hasAttribute('data-selected')).toBe(false)
    }
  })

  it('does not apply pending styling when pendingFill layer differs from rail layer', () => {
    // PendingFill targets enc 0 CCW on layer 0, but rail is layer 1.
    // No hole-zone should appear.
    render(
      <EncoderRail
        layer={1}
        encoders={THREE_ENCODERS}
        selectedTarget={null}
        pendingFill={{
          target: { kind: 'encoder', layer: 0, encoder: 0, clockwise: 0 },
          kind: 'LT',
          fixed: { layer: 2 },
          hole: 'tap',
        }}
        onSelectSlot={() => {}}
      />,
    )
    expect(screen.queryByTestId('hole-zone')).toBeNull()
  })
})
