import type { CSSProperties } from 'react'
import { usePickerStore } from '@/store/picker'
import { useConstants } from '@/queries/constants'
import { canTabFill } from './templateFill'
import { PickerCatalog } from './PickerCatalog'
import { DetailsStrip } from './DetailsStrip'
import { BuilderChip } from './BuilderChip'

interface PickerDockProps {
  layerCount: number
}

// Family color map for tab chips — mirrors PickerCatalog's tabChipStyle
const FAMILY_TAB_STYLE: Record<string, CSSProperties> = {
  '#93c5fd': { background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' },
  '#c4b5fd': { background: '#f5f3ff', borderColor: '#c4b5fd', color: '#6d28d9' },
  '#67e8f9': { background: '#ecfeff', borderColor: '#67e8f9', color: '#0891b2' },
  '#fdba74': { background: '#fff7ed', borderColor: '#fdba74', color: '#c2410c' },
}

const FAMILY_TAB_ACTIVE: Record<string, CSSProperties> = {
  '#93c5fd': { background: '#1d4ed8', borderColor: '#1d4ed8', color: '#fff' },
  '#c4b5fd': { background: '#6d28d9', borderColor: '#6d28d9', color: '#fff' },
  '#67e8f9': { background: '#0891b2', borderColor: '#0891b2', color: '#fff' },
  '#fdba74': { background: '#c2410c', borderColor: '#c2410c', color: '#fff' },
}

export function PickerDock({ layerCount }: PickerDockProps) {
  const { data: constants } = useConstants()
  const {
    dockOpen, dockPinned, pending, hovered, activeTab, query,
    togglePin, setTab, setQuery, setHovered, setPending,
  } = usePickerStore()

  const tabs = constants?.keycode_view?.tabs ?? []
  const expanded = dockOpen || dockPinned

  const borderColor = pending
    ? '#d69e2e'
    : 'hsl(var(--border))'

  const handleCancelPending = () => setPending(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && pending) {
      e.preventDefault()
      setPending(null)
    }
  }

  const onPick = (code: import('@/xap/types').KeyCode) => {
    // In Task 5 we just close pending on pick; full completeFill wiring is Task 6
    if (pending) setPending(null)
    // TODO(Task6): completeFill(pending, code) -> write to keymap
    void code
  }

  return (
    <div
      style={{
        borderTop: `2px solid ${borderColor}`,
        background: 'hsl(var(--muted) / 0.3)',
        transition: 'border-color 0.15s',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Peek bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={() =>
            expanded
              ? usePickerStore.getState().close()
              : usePickerStore.getState().open({ layer: 0, row: 0, column: 0 })
          }
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
            color: 'hsl(var(--muted-foreground))',
            fontSize: 11,
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label={expanded ? 'Collapse picker' : 'Expand picker'}
        >
          {expanded ? '▼' : '▲'}
        </button>

        {/* Pending state: builder chip + cancel hint */}
        {pending && (
          <>
            <span style={{ fontSize: 9, color: '#2d3748', fontWeight: 600 }}>Setting up:</span>
            <BuilderChip pending={pending} />
            <span style={{ fontSize: 9, color: '#a0aec0' }}>
              Esc or{' '}
              <button
                type="button"
                onClick={handleCancelPending}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#a0aec0',
                  fontSize: 9,
                  textDecoration: 'underline',
                }}
              >
                ✕
              </button>{' '}
              to cancel
            </span>
          </>
        )}

        {/* Tab chips */}
        {tabs.map((t) => {
          const isActive = t.id === activeTab
          const isDim = pending && !canTabFill(pending, t.id)
          const familyStyle = t.color ? FAMILY_TAB_STYLE[t.color] : null
          const activeStyle = t.color
            ? (FAMILY_TAB_ACTIVE[t.color] ?? { background: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))', color: '#fff' })
            : { background: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))', color: '#fff' }

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '4px 10px',
                fontSize: 10,
                borderRadius: 9999,
                border: '1px solid',
                cursor: 'pointer',
                fontWeight: 500,
                opacity: isDim ? 0.4 : 1,
                transition: 'opacity 0.15s',
                ...(isActive
                  ? activeStyle
                  : familyStyle
                    ? familyStyle
                    : {
                        background: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--muted-foreground))',
                      }),
              }}
            >
              {t.label}
            </button>
          )
        })}

        {/* Search input */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              border: '1px solid hsl(var(--input))',
              borderRadius: 'calc(var(--radius) - 2px)',
              background: 'hsl(var(--background))',
              padding: '0 8px',
              fontSize: 10,
              boxShadow: '0 1px 2px rgb(0 0 0 / .04)',
            }}
          >
            <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>&#128269;</span>
            <input
              type="text"
              placeholder={pending ? 'search basic keys' : 'search keycodes'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 10,
                color: 'hsl(var(--foreground))',
                width: 100,
              }}
            />
          </div>

          {/* Pin toggle */}
          <button
            type="button"
            onClick={togglePin}
            title={dockPinned ? 'Unpin picker' : 'Pin picker open'}
            style={{
              width: 26,
              height: 26,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: dockPinned ? 'hsl(var(--primary))' : 'transparent',
              border: '1px solid',
              borderColor: dockPinned ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              borderRadius: 'calc(var(--radius) - 2px)',
              cursor: 'pointer',
              color: dockPinned ? '#fff' : 'hsl(var(--muted-foreground))',
              fontSize: 12,
            }}
          >
            &#128204;
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && tabs.length > 0 && (
        <div
          style={{
            padding: '0 12px 12px',
            borderTop: '1px solid hsl(var(--border))',
          }}
        >
          <div style={{ paddingTop: 10 }}>
            <PickerCatalog
              tabs={tabs}
              layerCount={layerCount}
              activeTab={activeTab}
              query={query}
              onPick={onPick}
              onHover={setHovered}
              hideTabs
            />
            <DetailsStrip hovered={hovered} />
          </div>
        </div>
      )}
    </div>
  )
}
