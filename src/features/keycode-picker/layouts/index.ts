import { ANSI_LAYOUT } from './ansi'
import type { KeyboardLayoutDef } from './types'

export { ANSI_LAYOUT } from './ansi'
export type { PhysicalKey, KeyboardLayoutDef } from './types'
export { resolveLayout } from './resolve'
export type { ResolvedKey } from './resolve'

export const DEFAULT_LAYOUT = 'ansi'

export const LAYOUTS: Record<string, KeyboardLayoutDef> = {
  ansi: ANSI_LAYOUT,
}

export function getLayout(id: string): KeyboardLayoutDef {
  return LAYOUTS[id] ?? LAYOUTS[DEFAULT_LAYOUT]
}

export function listLayouts(): { id: string; label: string }[] {
  return Object.values(LAYOUTS).map((l) => ({ id: l.id, label: l.label }))
}
