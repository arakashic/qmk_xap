import { describe, expect, it } from 'vitest'

import { formatBcdVersion } from './format'

describe('formatBcdVersion', () => {
    it('formats BCD-encoded XAP and QMK versions as dotted versions', () => {
        expect(formatBcdVersion(0x03020115)).toBe('3.2.115')
        expect(formatBcdVersion(0x00030000)).toBe('0.3.0')
        expect(formatBcdVersion(0x00000001)).toBe('0.0.1')
    })

    it('formats decimal-string versions returned by the backend', () => {
        expect(formatBcdVersion(String(0x03020115))).toBe('3.2.115')
    })

    it('falls back to hex for invalid BCD values', () => {
        expect(formatBcdVersion(0x03020a15)).toBe('0x03020A15')
    })
})
