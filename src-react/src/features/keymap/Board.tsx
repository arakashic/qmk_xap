import type { MappedKeymap, MappedKeymapKey } from '@/xap/types'
import { KeyCap } from './KeyCap'

// One key unit in pixels. Matches the 34px key in the mockup at 1u.
const KEY_UNIT = 38  // px per QMK layout unit

interface BoardProps {
  keymap: MappedKeymap
  layer: number
}

export function Board({ keymap, layer }: BoardProps) {
  const layerKeys = keymap.keys[layer]
  if (!layerKeys) return null

  // Collect all non-null keys with their layout positions
  const keys: MappedKeymapKey[] = []
  for (const row of layerKeys) {
    for (const key of row) {
      if (key !== null) keys.push(key)
    }
  }

  if (keys.length === 0) return null

  // Compute the board size from the max x+w and y+h extents
  let maxX = 0
  let maxY = 0
  for (const k of keys) {
    const right = k.layout.x + (k.layout.w ?? 1)
    const bottom = k.layout.y + (k.layout.h ?? 1)
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }

  const boardWidth = maxX * KEY_UNIT
  const boardHeight = maxY * KEY_UNIT
  // gap between keys: 2px on each side
  const GAP = 2

  return (
    <div style={{ position: 'relative', width: boardWidth, height: boardHeight }}>
      {keys.map((k) => {
        const w = (k.layout.w ?? 1) * KEY_UNIT - GAP * 2
        const h = (k.layout.h ?? 1) * KEY_UNIT - GAP * 2
        const left = k.layout.x * KEY_UNIT + GAP
        const top = k.layout.y * KEY_UNIT + GAP

        // Use key-unit sizing and key radius (not cap radius)
        return (
          <div
            key={`${k.layout.matrix.y}-${k.layout.matrix.x}`}
            style={{ position: 'absolute', left, top, borderRadius: 'var(--key-radius)' }}
          >
            <KeyCap code={k.key.code} width={w} height={h} />
          </div>
        )
      })}
    </div>
  )
}
