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
        encoders={THREE_ENCODERS}
        selectedTarget={null}
        pendingFill={null}
        onSelectSlot={() => {}}
      />,
    )
    expect(screen.getAllByText('↺')).toHaveLength(3)
    expect(screen.getAllByText('↻')).toHaveLength(3)
  })
})
