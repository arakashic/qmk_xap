import { describe, it, expect } from 'vitest'
import { fuzzyScore, filterCodes } from './fuzzy'
import type { KeyCode } from '@gen/xap-types'

describe('fuzzyScore', () => {
  it('matches by label', () => {
    const code: KeyCode = { key: 'KC_MPLY', label: 'Play Pause' }
    expect(fuzzyScore('play', code)).not.toBeNull()
  })

  it('matches by key (name)', () => {
    const code: KeyCode = { key: 'KC_MPLY' }
    expect(fuzzyScore('mply', code)).not.toBeNull()
  })

  it('matches by description', () => {
    const code: KeyCode = { key: 'KC_VOLU', description: 'Volume Up' }
    expect(fuzzyScore('volume', code)).not.toBeNull()
  })

  it('matches by aliases', () => {
    const code: KeyCode = { key: 'KC_A', aliases: ['ALPHA', 'LETTER_A'] }
    expect(fuzzyScore('letter', code)).not.toBeNull()
  })

  it('rejects non-matches', () => {
    const code: KeyCode = { key: 'KC_A', label: 'A' }
    expect(fuzzyScore('zzzz', code)).toBeNull()
  })

  it('case-insensitive matching', () => {
    const code: KeyCode = { key: 'KC_MPLY', label: 'Play Pause' }
    expect(fuzzyScore('PLAY', code)).not.toBeNull()
  })

  it('substring match scores higher than scattered', () => {
    const code: KeyCode = { key: 'KC_TEST', label: 'Test Label' }
    const substringScore = fuzzyScore('test', code)
    const scatteredScore = fuzzyScore('tl', code)
    expect(substringScore).not.toBeNull()
    expect(scatteredScore).not.toBeNull()
    expect(substringScore! > scatteredScore!).toBe(true)
  })
})

describe('filterCodes', () => {
  it('empty query keeps all in original order', () => {
    const codes: KeyCode[] = [{ key: 'KC_A' }, { key: 'KC_B' }]
    expect(filterCodes('', codes)).toEqual(codes)
  })

  it('filters and sorts by score', () => {
    const codes: KeyCode[] = [
      { key: 'KC_A', label: 'Alpha' },
      { key: 'KC_B', label: 'Bravo' },
      { key: 'KC_ALPHA', label: 'Alpha Key' },
    ]
    const result = filterCodes('alpha', codes)
    expect(result.length).toBe(2)
    expect(result[0].key).toBe('KC_ALPHA') // substring match scores higher
    expect(result[1].key).toBe('KC_A')
  })

  it('excludes non-matches', () => {
    const codes: KeyCode[] = [
      { key: 'KC_A', label: 'Alpha' },
      { key: 'KC_B', label: 'Bravo' },
    ]
    const result = filterCodes('zzzz', codes)
    expect(result).toEqual([])
  })
})
