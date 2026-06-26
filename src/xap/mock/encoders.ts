import type { EncoderKeymap } from '../client'

const TRNS = { key: 'KC_TRNS', label: '▽' }

// ugo_rev3_full has 3 encoders, 2 layers.
// Layer 0: Vol-/Vol+, Prev/Next, TRNS/TRNS
// Layer 1: all TRNS
export const ugoEncoders: EncoderKeymap = [
  [
    { ccw: { key: 'KC_VOLD', label: 'Vol-' }, cw: { key: 'KC_VOLU', label: 'Vol+' } },
    { ccw: { key: 'KC_MPRV', label: 'Prev' }, cw: { key: 'KC_MNXT', label: 'Next' } },
    { ccw: { ...TRNS },                        cw: { ...TRNS } },
  ],
  [
    { ccw: { ...TRNS }, cw: { ...TRNS } },
    { ccw: { ...TRNS }, cw: { ...TRNS } },
    { ccw: { ...TRNS }, cw: { ...TRNS } },
  ],
]
