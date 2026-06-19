import type { MappedKeymap, MappedKeymapKey, KeyCode } from '@/xap/types'
import type { KeyTarget, PickerTarget, PendingFill } from '@/features/keycode-picker/templateFill'
import { KeyCap } from './KeyCap'

// Build a synthetic split KeyCode for the pending preview.
// Renders the chosen hold as filled + tap zone as the dashed hole.
// legendOf derives split labels from template.kind/mod_mask/layer — no extra fields needed.
function pendingPreviewCode(fill: PendingFill): KeyCode | null {
  if (fill.hole !== 'tap') return null
  if (fill.kind === 'MT') {
    return {
      key: `MT(${fill.fixed.mod_mask ?? 0},?)`,
      template: { kind: 'ModTap', mod_mask: fill.fixed.mod_mask ?? 0, tap_kc: null },
    }
  }
  if (fill.kind === 'LT') {
    return {
      key: `LT(${fill.fixed.layer ?? 0},?)`,
      template: { kind: 'LayerTap', layer: fill.fixed.layer ?? 0, tap_kc: null },
    }
  }
  return null
}

// One key unit in pixels. Matches the 34px key in the mockup at 1u.
const KEY_UNIT = 38  // px per QMK layout unit

interface BoardProps {
  keymap: MappedKeymap
  layer: number
  /** Called when a board key is clicked; passes the key's fill target. */
  onSelectKey?: (target: KeyTarget) => void
  /** Which key is currently selected (shown with blue outline). */
  selectedTarget?: PickerTarget | null
  /** If set, the key at this target renders the pending preview (split with holeZone=tap). */
  pendingFill?: PendingFill | null
}

function isSameKeyTarget(a: PickerTarget, b: KeyTarget): boolean {
  return a.kind === 'key' && a.layer === b.layer && a.row === b.row && a.column === b.column
}

export function Board({ keymap, layer, onSelectKey, selectedTarget, pendingFill }: BoardProps) {
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

        const keyRow = Number(k.layout.matrix.y)
        const keyCol = Number(k.layout.matrix.x)
        const target: KeyTarget = { kind: 'key', layer, row: keyRow, column: keyCol }

        const isSelected = selectedTarget != null && isSameKeyTarget(selectedTarget, target)
        const isPending =
          pendingFill != null &&
          pendingFill.target.kind === 'key' &&
          isSameKeyTarget(pendingFill.target, target)

        // Pending preview: synthesize a split code so the cap renders with the
        // hold filled and a dashed "?" hole in the tap zone.
        const preview = isPending ? pendingPreviewCode(pendingFill) : null
        const displayCode = preview ?? k.key.code
        const holeZone = preview != null ? 'tap' as const : undefined

        return (
          <button
            key={`${k.layout.x}-${k.layout.y}`}
            type="button"
            onClick={onSelectKey ? () => onSelectKey(target) : undefined}
            style={{
              position: 'absolute',
              left,
              top,
              borderRadius: 'var(--key-radius)',
              // Blue outline for the selected key (mockup .selkey)
              outline: isSelected ? '2px solid hsl(var(--primary))' : undefined,
              outlineOffset: isSelected ? 1 : undefined,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: onSelectKey ? 'pointer' : 'default',
            }}
          >
            <KeyCap code={displayCode} width={w} height={h} holeZone={holeZone} />
          </button>
        )
      })}
    </div>
  )
}
