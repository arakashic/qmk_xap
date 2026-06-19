import { describe, it, expect } from 'vitest'
import { filterTree } from './ConfigTree'

describe('filterTree', () => {
  const tree = {
    tapping: { tapping_term: 200, permissive_hold: true },
    rgb_matrix: { max_brightness: 150 },
  }

  it('returns whole tree on empty query', () => {
    expect(filterTree(tree, '')).toEqual(tree)
  })

  it('keeps matching key and ancestor, drops non-matching branch', () => {
    const result = filterTree(tree, 'tapping_term') as Record<string, unknown>
    expect(result).not.toBeNull()
    expect(result['tapping']).toEqual({ tapping_term: 200 })
    expect(result['rgb_matrix']).toBeUndefined()
  })

  it('returns null when nothing matches', () => {
    expect(filterTree(tree, 'nonexistent_key')).toBeNull()
  })

  it('matches leaf value (case-insensitive)', () => {
    // 'solid_color' appears as a key inside animations
    const data = { animations: { solid_color: true } }
    const result = filterTree(data, 'SOLID_COLOR') as Record<string, unknown>
    expect(result).not.toBeNull()
    expect((result['animations'] as Record<string, unknown>)['solid_color']).toBe(true)
  })

  it('matches string leaf value', () => {
    const data = { keyboard_name: 'Protok Model II' }
    const result = filterTree(data, 'protok') as Record<string, unknown>
    expect(result).not.toBeNull()
    expect(result['keyboard_name']).toBe('Protok Model II')
  })

  it('handles leaf node (non-object) - returns leaf if matches, null otherwise', () => {
    expect(filterTree(200, '200')).toBe(200)
    expect(filterTree(200, 'foo')).toBeNull()
  })

  it('handles array nodes like objects', () => {
    const data = { rows: ['B0', 'B1'], cols: ['C0'] }
    const result = filterTree(data, 'rows') as Record<string, unknown>
    expect(result).not.toBeNull()
    expect(result['rows']).toEqual(['B0', 'B1'])
    expect(result['cols']).toBeUndefined()
  })

  describe('array branch — no null placeholders', () => {
    it('single match: returns only matching element, no null slots', () => {
      expect(filterTree(['B0', 'B1', 'C0'], 'B0')).toEqual(['B0'])
    })

    it('multiple matches: returns all matching elements compacted', () => {
      expect(filterTree(['B0', 'B1', 'C0'], 'B')).toEqual(['B0', 'B1'])
    })

    it('no match: returns null', () => {
      expect(filterTree(['B0', 'B1', 'C0'], 'Z')).toBeNull()
    })
  })
})
