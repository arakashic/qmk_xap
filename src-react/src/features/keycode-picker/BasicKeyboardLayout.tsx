import React from 'react'
import type { KeyCode } from '@/xap/types'
import { KeyCap } from '@/features/keymap/KeyCap'
import { resolveLayout } from './layouts/resolve'
import type { KeyboardLayoutDef } from './layouts/types'

export interface BasicKeyboardLayoutProps {
  codes: KeyCode[]
  layout: KeyboardLayoutDef
  onPick: (code: KeyCode) => void
  onHover: (code: KeyCode | null) => void
}

const UNIT = 42
const GAP = 3

export function BasicKeyboardLayout({ codes, layout, onPick, onHover }: BasicKeyboardLayoutProps): React.JSX.Element {
  const resolved = resolveLayout(codes, layout)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          position: 'relative',
          width: layout.width * UNIT,
          height: layout.height * UNIT,
        }}
      >
        {resolved.map(({ pos, code }) => {
          const w = pos.w * UNIT - GAP
          const h = pos.h * UNIT - GAP
          const posStyle: React.CSSProperties = {
            position: 'absolute',
            left: pos.x * UNIT,
            top: pos.y * UNIT,
            width: w,
            height: h,
          }

          if (code != null) {
            return (
              <button
                key={pos.key}
                data-testid="layout-key"
                aria-label={code.key}
                onClick={() => onPick(code)}
                // hover/focus outline set inline (mouse via onMouseEnter/Leave, keyboard via onFocus/Blur)
                onMouseEnter={(e) => { onHover(code); e.currentTarget.style.outline = '2px solid hsl(var(--primary))' }}
                onMouseLeave={(e) => { onHover(null); e.currentTarget.style.outline = 'none' }}
                style={{
                  ...posStyle,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--key-radius)',
                }}
                onFocus={(e) => { e.currentTarget.style.outline = '2px solid hsl(var(--primary))' }}
                onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
              >
                <KeyCap code={code} width={w} height={h} />
              </button>
            )
          }

          const shortLabel = pos.key.startsWith('KC_') ? pos.key.slice(3) : pos.key
          return (
            <div
              key={pos.key}
              data-testid="layout-ghost"
              style={{
                ...posStyle,
                opacity: 0.3,
                border: '1px dashed currentColor',
                borderRadius: 'var(--key-radius)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                userSelect: 'none',
              }}
            >
              {shortLabel}
            </div>
          )
        })}
      </div>
    </div>
  )
}
