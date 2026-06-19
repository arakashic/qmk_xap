import type { CSSProperties } from 'react'
import type { KeycodeViewTab, KeyCode } from '@/xap/types'
import { filterCodes } from './fuzzy'
import { PickerKey } from './PickerKey'

// ANSI rows for render_mode:'ansi' layout
// The codes list is reordered to rows for display
const ANSI_ROW_KEYS = [
  ['KC_ESC','KC_1','KC_2','KC_3','KC_4','KC_5','KC_6','KC_7','KC_8','KC_9','KC_0','KC_MINS','KC_EQL','KC_BSPC'],
  ['KC_TAB','KC_Q','KC_W','KC_E','KC_R','KC_T','KC_Y','KC_U','KC_I','KC_O','KC_P','KC_LBRC','KC_RBRC','KC_BSLS'],
  ['KC_CAPS','KC_A','KC_S','KC_D','KC_F','KC_G','KC_H','KC_J','KC_K','KC_L','KC_SCLN','KC_QUOT','KC_ENTER'],
  ['KC_LSFT','KC_Z','KC_X','KC_C','KC_V','KC_B','KC_N','KC_M','KC_COMM','KC_DOT','KC_SLSH','KC_RSFT'],
  ['KC_LCTL','KC_LGUI','KC_LALT','KC_SPACE','KC_RALT','KC_RGUI','KC_RCTL'],
]

function buildAnsiRows(codes: KeyCode[]): KeyCode[][] {
  // Group codes by key, then reorder per ANSI rows
  const byKey = new Map(codes.map((c) => [c.key, c]))
  const rows: KeyCode[][] = []
  for (const rowKeys of ANSI_ROW_KEYS) {
    const row: KeyCode[] = []
    for (const key of rowKeys) {
      const c = byKey.get(key)
      if (c) row.push(c)
    }
    if (row.length > 0) rows.push(row)
  }
  // Remaining codes not matched by ANSI rows fall into an extra row
  const usedKeys = new Set(ANSI_ROW_KEYS.flat())
  const remaining = codes.filter((c) => !usedKeys.has(c.key))
  if (remaining.length > 0) rows.push(remaining)
  return rows
}

function expandLayerTemplate(kind: string, layerCount: number): KeyCode[] {
  return Array.from({ length: layerCount }, (_, i) => ({
    key: `${kind}(${i})`,
    label: `L${i}`,
    template: { kind: 'LayerOp', op: kind, layer: i } as KeyCode['template'],
  }))
}

// Human-readable short name for a QMK mod string
const MOD_SHORT: Record<string, string> = {
  LCTL: 'Ctrl', LSFT: 'Shift', LALT: 'Alt', LGUI: 'GUI',
  RCTL: 'RCtrl', RSFT: 'RShift', RALT: 'RAlt', RGUI: 'RGUI',
  MEH: 'Meh', HYPR: 'Hyper',
}

// Build a descriptive KeyCode for a modifier entry in MT / QK_MODS subgroups.
function expandModTemplate(kind: string, mods: string[]): KeyCode[] {
  return mods.map((mod) => ({
    key: `${kind}(${mod})`,
    label: MOD_SHORT[mod] ?? mod,
  }))
}

// For OSL (one-shot layer) subgroup
function expandOslTemplate(layerCount: number): KeyCode[] {
  return Array.from({ length: layerCount }, (_, i) => ({
    key: `OSL(${i})`,
    label: `L${i}`,
    template: { kind: 'LayerOp', op: 'OSL', layer: i } as KeyCode['template'],
  }))
}

// Inline hold-mod key for MT/QK_MODS template expansions.
// These are picker-UI constructs (not actual keycodes), so rendered directly
// rather than through KeyCap, to apply the modtap family tint.
interface PickerHoldKeyProps {
  code: KeyCode
  family: 'modtap' | 'modified'
  onPick: (code: KeyCode) => void
  onHover: (code: KeyCode | null) => void
}

const HOLD_STYLE: Record<string, CSSProperties> = {
  modtap:   { background: 'var(--fam-modtap-bg)',   border: '1px solid var(--fam-modtap-bd)',   color: 'var(--fam-modtap-fg)' },
  modified: { background: 'var(--fam-modified-bg)', border: '1px solid var(--fam-modified-bd)', color: 'var(--fam-modified-fg)' },
}

function PickerHoldKey({ code, family, onPick, onHover }: PickerHoldKeyProps) {
  return (
    <button
      type="button"
      onClick={() => onPick(code)}
      onMouseEnter={() => onHover(code)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: 42,
        height: 34,
        padding: 0,
        cursor: 'pointer',
        borderRadius: 'var(--cap-radius)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...HOLD_STYLE[family],
      }}
    >
      <span style={{ fontSize: 6, lineHeight: 1, marginBottom: 1, color: 'inherit', opacity: 0.8 }}>hold</span>
      <span style={{ fontSize: 11, fontWeight: 600 }}>{code.label ?? code.key}</span>
    </button>
  )
}

// Family color for a tab (inactive state: light tint bg)
function tabChipStyle(color: string | null): CSSProperties {
  if (!color) return {}
  const colorMap: Record<string, CSSProperties> = {
    '#93c5fd': { background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' },
    '#c4b5fd': { background: '#f5f3ff', borderColor: '#c4b5fd', color: '#6d28d9' },
    '#67e8f9': { background: '#ecfeff', borderColor: '#67e8f9', color: '#0891b2' },
    '#fdba74': { background: '#fff7ed', borderColor: '#fdba74', color: '#c2410c' },
  }
  return colorMap[color] ?? {}
}

// Active tab: family tabs use their saturated dark color; others use --primary
function activeTabChipStyle(color: string | null): CSSProperties {
  const familyActive: Record<string, CSSProperties> = {
    '#93c5fd': { background: '#1d4ed8', borderColor: '#1d4ed8', color: '#fff' },
    '#c4b5fd': { background: '#6d28d9', borderColor: '#6d28d9', color: '#fff' },
    '#67e8f9': { background: '#0891b2', borderColor: '#0891b2', color: '#fff' },
    '#fdba74': { background: '#c2410c', borderColor: '#c2410c', color: '#fff' },
  }
  if (color && familyActive[color]) return familyActive[color]
  return { background: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))', color: '#fff' }
}

interface PickerCatalogProps {
  tabs: KeycodeViewTab[]
  layerCount: number
  activeTab: string
  query: string
  onPick: (code: KeyCode) => void
  onHover: (code: KeyCode | null) => void
  /** Tab id that should appear dimmed (e.g. while a two-step fill is in progress) */
  dimTab?: string
  /** When true, suppresses the tab chip row (caller owns tab switching UI) */
  hideTabs?: boolean
}

export function PickerCatalog({
  tabs,
  layerCount,
  activeTab,
  query,
  onPick,
  onHover,
  dimTab,
  hideTabs,
}: PickerCatalogProps) {
  const tab = tabs.find((t) => t.id === activeTab) ?? tabs[0]
  if (!tab) return null

  return (
    <div>
      {/* Tab chips — suppressed when caller (PickerDock) owns the tab bar */}
      {!hideTabs && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          {tabs.map((t) => {
            const isActive = t.id === activeTab
            const isDim = dimTab && t.id !== activeTab && t.id === dimTab
            const chipStyle = tabChipStyle(t.color)
            return (
              <span
                key={t.id}
                style={{
                  padding: '3px 9px',
                  fontSize: 10,
                  borderRadius: 9999,
                  border: '1px solid',
                  opacity: isDim ? 0.4 : 1,
                  cursor: 'default',
                  fontWeight: 500,
                  ...(isActive
                    ? activeTabChipStyle(t.color ?? null)
                    : t.color
                      ? chipStyle
                      : { background: '#fff', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }),
                }}
              >
                {t.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Subgroups */}
      {tab.subgroups.map((sg) => {
        const tmpl = sg.template

        if (sg.render_mode === 'ansi') {
          // ANSI row layout
          const filtered = query ? filterCodes(query, sg.codes) : sg.codes
          const rows = query ? [filtered] : buildAnsiRows(sg.codes)
          return (
            <div key={sg.id}>
              {sg.label && (
                <div style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>
                  {sg.label}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                {rows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 3 }}>
                    {row.map((code) => (
                      <PickerKey key={code.key} code={code} onPick={onPick} onHover={onHover} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        if (tmpl) {
          // Template expansion
          const isModTemplate = tmpl.kind === 'MT' || tmpl.kind === 'QK_MODS'
          let expanded: KeyCode[] = []
          if (tmpl.kind === 'OSL') {
            expanded = expandOslTemplate(layerCount)
          } else if (isModTemplate) {
            expanded = expandModTemplate(tmpl.kind, tmpl.mods)
          } else {
            // MO, TG, TO, DF, TT, PDF, LT, LM — all layer-indexed
            expanded = expandLayerTemplate(tmpl.kind, layerCount)
          }

          const filtered = query ? filterCodes(query, expanded) : expanded
          const holdFamily: 'modtap' | 'modified' = tmpl.kind === 'QK_MODS' ? 'modified' : 'modtap'
          return (
            <div key={sg.id} style={{ marginBottom: 8 }}>
              {sg.label && (
                <div style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>
                  {sg.label}
                </div>
              )}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {filtered.map((code) =>
                  isModTemplate ? (
                    <PickerHoldKey key={code.key} code={code} family={holdFamily} onPick={onPick} onHover={onHover} />
                  ) : (
                    <PickerKey key={code.key} code={code} onPick={onPick} onHover={onHover} />
                  )
                )}
              </div>
            </div>
          )
        }

        // Plain codes grid
        const filtered = query ? filterCodes(query, sg.codes) : sg.codes
        return (
          <div key={sg.id} style={{ marginBottom: 8 }}>
            {sg.label && (
              <div style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>
                {sg.label}
              </div>
            )}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {filtered.map((code) => (
                <PickerKey key={code.key} code={code} onPick={onPick} onHover={onHover} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
