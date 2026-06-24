import type { KeyCode } from '@/xap/types'
import type { PhysicalKey, KeyboardLayoutDef } from './types'

export interface ResolvedKey {
  pos: PhysicalKey
  code: KeyCode | null
}

export function resolveLayout(codes: KeyCode[], layout: KeyboardLayoutDef): ResolvedKey[] {
  const lookup = new Map<string, KeyCode>()
  for (const code of codes) {
    lookup.set(code.key, code)
    for (const alias of code.aliases ?? []) {
      lookup.set(alias, code)
    }
  }

  return layout.keys.map((pos) => {
    const names = [pos.key, ...(pos.aliases ?? [])]
    for (const name of names) {
      const code = lookup.get(name)
      if (code !== undefined) return { pos, code }
    }
    return { pos, code: null }
  })
}
