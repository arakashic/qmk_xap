import type { CSSProperties } from 'react'
import type { KeycodeViewTab, KeyCode } from '@/xap/types'
import { modName } from '@/features/keymap/legend'
import { filterCodes } from './fuzzy'
import { PickerKey } from './PickerKey'
import { BasicKeyboardLayout } from './BasicKeyboardLayout'
import { getLayout } from './layouts/index'
import { usePrefsStore } from '@/store/prefs'
import { PICKER_CAP_W, PICKER_CAP_H, PICKER_GAP } from './capSize'

function expandLayerTemplate(kind: string, layerCount: number): KeyCode[] {
  return Array.from({ length: layerCount }, (_, i) => {
    // LT and LM are two-step picks (need a second hole fill); embed a partial
    // template so the onPick handler can detect them.
    if (kind === 'LT') {
      return {
        key: `LT(${i})`,
        label: `L${i}`,
        template: { kind: 'LayerTap', layer: i, tap_kc: null } as KeyCode['template'],
      }
    }
    if (kind === 'LM') {
      return {
        key: `LM(${i})`,
        label: `L${i}`,
        template: { kind: 'LayerMod', layer: i, mod_mask: null } as KeyCode['template'],
      }
    }
    return {
      key: `${kind}(${i})`,
      label: `L${i}`,
      template: { kind: 'LayerOp', op: kind, layer: i } as KeyCode['template'],
    }
  })
}

// QMK mod bit masks (MOD_LCTL=0x01, MOD_LSFT=0x02, etc.)
const MOD_MASK: Record<string, number> = {
  LCTL: 0x01, LSFT: 0x02, LALT: 0x04, LGUI: 0x08,
  RCTL: 0x10, RSFT: 0x20, RALT: 0x40, RGUI: 0x80,
  MEH: 0x07, HYPR: 0x0F,
}

// Build a descriptive KeyCode for a modifier entry in MT / QK_MODS subgroups.
// MT entries embed a partial ModTap template (tap_kc: null = hole) so the
// onPick handler can detect them as two-step picks.
function expandModTemplate(kind: string, mods: string[]): KeyCode[] {
  return mods.map((mod) => {
    const mask = MOD_MASK[mod] ?? 0
    const label = modName(mask)
    if (kind === 'MT') {
      return {
        key: `MT(${mod})`,
        label,
        template: { kind: 'ModTap', mod_mask: mask, tap_kc: null } as KeyCode['template'],
      }
    }
    // QK_MODS (Modified) — single-step, no hole needed
    return {
      key: `${kind}(${mod})`,
      label,
    }
  })
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
        width: PICKER_CAP_W,
        height: PICKER_CAP_H,
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
      <span style={{ fontSize: 7, lineHeight: 1, marginBottom: 1, color: 'inherit', opacity: 0.8 }}>hold</span>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{code.label ?? code.key}</span>
    </button>
  )
}

interface PickerCatalogProps {
  tabs: KeycodeViewTab[]
  layerCount: number
  activeTab: string
  query: string
  onPick: (code: KeyCode) => void
  onHover: (code: KeyCode | null) => void
}

export function PickerCatalog({
  tabs,
  layerCount,
  activeTab,
  query,
  onPick,
  onHover,
}: PickerCatalogProps) {
  const basicLayout = usePrefsStore((s) => s.basicLayout)
  const tab = tabs.find((t) => t.id === activeTab) ?? tabs[0]
  if (!tab) return null

  return (
    <div>
      {/* Subgroups for the active tab */}
      {tab.subgroups.map((sg) => {
        const tmpl = sg.template

        if (sg.render_mode === 'ansi') {
          if (query) {
            // Non-empty query: flat filtered grid
            const filtered = filterCodes(query, sg.codes)
            return (
              <div key={sg.id}>
                {sg.label && (
                  <div style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>
                    {sg.label}
                  </div>
                )}
                <div style={{ display: 'flex', gap: PICKER_GAP, flexWrap: 'wrap' }}>
                  {filtered.map((code) => (
                    <PickerKey key={code.key} code={code} onPick={onPick} onHover={onHover} />
                  ))}
                </div>
              </div>
            )
          }
          // Empty query: physical layout
          return (
            <div key={sg.id}>
              {sg.label && (
                <div style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>
                  {sg.label}
                </div>
              )}
              <BasicKeyboardLayout
                codes={sg.codes}
                layout={getLayout(basicLayout)}
                onPick={onPick}
                onHover={onHover}
              />
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
              <div style={{ display: 'flex', gap: PICKER_GAP, flexWrap: 'wrap' }}>
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
