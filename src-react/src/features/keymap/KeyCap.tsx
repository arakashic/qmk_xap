import type { KeyCode } from '@/xap/types'
import { legendOf } from './legend'
import type { LegendModel } from './legend'

// Cap size for the legend specimen (used standalone / in picker)
const CAP_SIZE = 58

interface KeyCapProps {
  /** The keycode to render. */
  code: KeyCode
  /** When true, renders in "live" mode: KC_TRNS shows a ghosted resolved key + green dot. */
  live?: boolean
  /** Resolved key to ghost under a KC_TRNS cap (only used when live=true). */
  resolvedCode?: KeyCode
  /** Override width/height in px (for Board keys which use key-unit sizing). */
  width?: number
  height?: number
  /**
   * When 'tap', and the legend is a split cap (ModTap / LayerTap),
   * draw the tap zone as a dashed amber box with "?" — the pending hole.
   */
  holeZone?: 'tap'
}

// ---- style helpers ---------------------------------------------------------

const BASE: React.CSSProperties = {
  border: '1px solid #aab2bd',
  borderRadius: 'var(--cap-radius)',
  background: '#fff',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  overflow: 'hidden',
  textAlign: 'center',
  lineHeight: 1.15,
  color: '#2d3748',
  boxSizing: 'border-box',
}

const FAMILY_STYLE: Record<string, React.CSSProperties> = {
  layer:    { background: 'var(--fam-layer-bg)',    borderColor: 'var(--fam-layer-bd)' },
  modtap:   { background: 'var(--fam-modtap-bg)',   borderColor: 'var(--fam-modtap-bd)' },
  layermod: { background: 'var(--fam-layermod-bg)', borderColor: 'var(--fam-layermod-bd)' },
  modified: { background: 'var(--fam-modified-bg)', borderColor: 'var(--fam-modified-bd)' },
}

const FAMILY_FG: Record<string, string> = {
  layer:    'var(--fam-layer-fg)',
  modtap:   'var(--fam-modtap-fg)',
  layermod: 'var(--fam-layermod-fg)',
  modified: 'var(--fam-modified-fg)',
}

const HOLD_STYLE: Record<string, React.CSSProperties> = {
  layer:  { background: 'var(--fam-layer-hold-bg)',  color: 'var(--fam-layer-hold-fg)' },
  modtap: { background: 'var(--fam-modtap-hold-bg)', color: 'var(--fam-modtap-hold-fg)' },
}

// ---- render helpers --------------------------------------------------------

function renderLegend(legend: LegendModel, live: boolean, width: number, height: number, resolvedCode?: KeyCode, holeZone?: 'tap'): React.ReactNode {
  switch (legend.kind) {
    case 'basic': {
      return (
        <>
          {legend.top && (
            <span style={{ position: 'absolute', top: 1, left: 0, right: 0, textAlign: 'center', fontSize: 7, color: '#94a3b8' }}>
              {legend.top}
            </span>
          )}
          {legend.label}
        </>
      )
    }

    case 'split': {
      const holdStyle = HOLD_STYLE[legend.family] ?? {}
      return (
        <>
          <div style={{ width: '100%', height: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, ...holdStyle }}>
            {legend.hold}
          </div>
          <div style={{ width: '100%', height: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {holeZone === 'tap'
              ? (
                  <span
                    data-testid="hole-zone"
                    style={{
                      border: '1px dashed #d69e2e',
                      borderRadius: 3,
                      padding: '0 5px',
                      fontSize: 9,
                      background: '#fffbea',
                      color: '#b7791f',
                    }}
                  >
                    ?
                  </span>
                )
              : legend.tap}
          </div>
        </>
      )
    }

    case 'descriptor': {
      const fgColor = legend.family ? FAMILY_FG[legend.family] : undefined
      return (
        <>
          <span style={{ fontSize: 8, color: fgColor ?? '#94a3b8', marginBottom: 2 }}>{legend.verb}</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{legend.payload}</span>
        </>
      )
    }

    case 'prefix': {
      return (
        <>
          <span style={{ fontSize: 8, color: '#94a3b8', marginBottom: 3 }}>{legend.tag}</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{legend.payload}</span>
        </>
      )
    }

    case 'modified': {
      return (
        <>
          {legend.output}
          <span style={{ position: 'absolute', bottom: 1, right: 2, fontSize: 6, fontFamily: '"JetBrains Mono", monospace', color: '#a0aec0' }}>
            {legend.corner}
          </span>
        </>
      )
    }

    case 'trns': {
      if (live && resolvedCode) {
        // Ghost the resolved key recursively at 35% opacity + green live dot.
        // No stripe background applied (m3: clean cap behind the ghost).
        return (
          <>
            <span style={{ position: 'absolute', top: 3, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#38a169' }} />
            <span style={{ opacity: 0.35, display: 'flex' }}>
              <KeyCap code={resolvedCode} width={width} height={height} />
            </span>
          </>
        )
      }
      // Non-live: stripe background (applied via capStyle) + ▽ glyph
      return <span style={{ color: '#94a3b8', fontSize: 16 }}>▽</span>
    }

    case 'no': {
      // Dotted "intentionally empty" — just a small dot
      return <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e0', display: 'inline-block' }} />
    }

    case 'hex': {
      return (
        <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 4, padding: '1px 5px', color: 'var(--fam-modified-fg)' }}>
          {`0x${legend.code.toString(16).toUpperCase().padStart(4, '0')}`}
        </span>
      )
    }
  }
}

function capStyle(legend: LegendModel, width: number, height: number, liveGhost: boolean): React.CSSProperties {
  const size: React.CSSProperties = { width, height }

  // Split caps need column layout without centering (children fill rows)
  const isSplit = legend.kind === 'split'
  const splitOverride: React.CSSProperties = isSplit
    ? { justifyContent: 'flex-start', padding: 0 }
    : {}

  // KC_TRNS stripe background: only for non-live render (m3: clean cap behind live ghost)
  const isTrns = legend.kind === 'trns'
  const trnsOverride: React.CSSProperties = isTrns && !liveGhost
    ? { background: 'repeating-linear-gradient(45deg,#fff,#fff 5px,#f8fafc 5px,#f8fafc 10px)' }
    : {}

  // KC_NO dotted border + grey bg
  const isNo = legend.kind === 'no'
  const noOverride: React.CSSProperties = isNo
    ? { background: '#f1f5f9', borderStyle: 'dashed', borderColor: '#cbd5e0' }
    : {}

  // Family tints (C2: removed dead third branch — descriptors already covered by first branch)
  const familyStyle: React.CSSProperties =
    (legend.kind === 'split' || legend.kind === 'descriptor') && legend.family
      ? FAMILY_STYLE[legend.family] ?? {}
      : legend.kind === 'modified'
        ? FAMILY_STYLE.modified
        : {}

  return { ...BASE, ...size, ...splitOverride, ...trnsOverride, ...noOverride, ...familyStyle }
}

// ---- component -------------------------------------------------------------

export function KeyCap({ code, live = false, resolvedCode, width = CAP_SIZE, height = CAP_SIZE, holeZone }: KeyCapProps) {
  const legend = legendOf(code)
  const liveGhost = legend.kind === 'trns' && live && resolvedCode !== undefined
  const style = capStyle(legend, width, height, liveGhost)
  return (
    <div style={style}>
      {renderLegend(legend, live, width, height, resolvedCode, holeZone)}
    </div>
  )
}
