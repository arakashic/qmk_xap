import { describe, it, expect } from 'vitest'
import { resolveLayout } from './resolve'
import { getLayout } from './index'
import type { KeyboardLayoutDef } from './types'
import type { KeyCode } from '@/xap/types'

const DEF: KeyboardLayoutDef = {
  id: 't', label: 'T', width: 3, height: 1,
  keys: [
    { key: 'KC_ESCAPE', aliases: ['KC_ESC'], x: 0, y: 0, w: 1, h: 1 },
    { key: 'KC_A', x: 1, y: 0, w: 1, h: 1 },
    { key: 'KC_HOME', x: 2, y: 0, w: 1, h: 1 },
  ],
}

it('matches a short-named (mock) catalog via the position alias', () => {
  const codes: KeyCode[] = [{ key: 'KC_ESC', label: 'Esc' }, { key: 'KC_A', label: 'A' }]
  const r = resolveLayout(codes, DEF)
  expect(r[0].code?.key).toBe('KC_ESC')   // matched ESCAPE via alias
  expect(r[1].code?.key).toBe('KC_A')
  expect(r[2].code).toBeNull()            // KC_HOME absent -> ghost
})

it('matches a canonical-named (real) catalog with short aliases', () => {
  const codes: KeyCode[] = [{ key: 'KC_ESCAPE', label: 'Esc', aliases: ['KC_ESC'] }]
  const r = resolveLayout(codes, DEF)
  expect(r[0].code?.key).toBe('KC_ESCAPE')
})

it('getLayout falls back to ansi for an unknown id', () => {
  expect(getLayout('does-not-exist').id).toBe('ansi')
  expect(getLayout('ansi').keys.length).toBeGreaterThan(50)
})
