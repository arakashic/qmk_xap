import type { CSSProperties, KeyboardEvent } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { usePickerStore } from '@/store/picker'
import { useConstants } from '@/queries/constants'
import { canTabFill } from './templateFill'
import { PickerCatalog } from './PickerCatalog'
import { DetailsStrip } from './DetailsStrip'
import { BuilderChip } from './BuilderChip'

interface PickerDockProps {
  layerCount: number
  /** Called when the user picks a keycode from the catalog. */
  onPick?: (code: import('@/xap/types').KeyCode) => void
}

// Inactive family tint styles (light bg)
const FAMILY_TAB_INACTIVE: Record<string, CSSProperties> = {
  '#93c5fd': { background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' },
  '#c4b5fd': { background: '#f5f3ff', borderColor: '#c4b5fd', color: '#6d28d9' },
  '#67e8f9': { background: '#ecfeff', borderColor: '#67e8f9', color: '#0891b2' },
  '#fdba74': { background: '#fff7ed', borderColor: '#fdba74', color: '#c2410c' },
}

// Active family color (saturated dark)
const FAMILY_TAB_ACTIVE: Record<string, CSSProperties> = {
  '#93c5fd': { background: '#1d4ed8', borderColor: '#1d4ed8', color: '#fff' },
  '#c4b5fd': { background: '#6d28d9', borderColor: '#6d28d9', color: '#fff' },
  '#67e8f9': { background: '#0891b2', borderColor: '#0891b2', color: '#fff' },
  '#fdba74': { background: '#c2410c', borderColor: '#c2410c', color: '#fff' },
}

const PRIMARY_ACTIVE: CSSProperties = {
  background: 'hsl(var(--primary))',
  borderColor: 'hsl(var(--primary))',
  color: '#fff',
}

export function PickerDock({ layerCount, onPick: onPickProp }: PickerDockProps) {
  const { data: constants } = useConstants()
  const {
    dockOpen, dockPinned, pending, hovered, activeTab, query,
    togglePin, setTab, setQuery, setHovered, setPending,
  } = usePickerStore()

  const tabs = constants?.keycode_view?.tabs ?? []
  const expanded = dockOpen || dockPinned

  const borderColor = pending ? '#d69e2e' : 'hsl(var(--border))'

  const handleCancelPending = () => setPending(null)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && pending) {
      e.preventDefault()
      setPending(null)
    }
  }

  const onPick = (code: import('@/xap/types').KeyCode) => {
    onPickProp?.(code)
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
              : usePickerStore.getState().open({ kind: 'key', layer: 0, row: 0, column: 0 })
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

        {/* Shadcn Tabs for the tab strip — controlled */}
        {tabs.length > 0 && (
          <Tabs value={activeTab} onValueChange={setTab}>
            <TabsList
              style={{
                background: 'transparent',
                height: 'auto',
                padding: 0,
                gap: 4,
                display: 'flex',
                flexWrap: 'wrap',
              }}
            >
              {tabs.map((t) => {
                const isActive = t.id === activeTab
                const isDim = pending != null && !canTabFill(pending, t.id)
                const inactiveStyle = t.color
                  ? (FAMILY_TAB_INACTIVE[t.color] ?? {
                      background: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--muted-foreground))',
                    })
                  : {
                      background: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--muted-foreground))',
                    }
                const activeStyle = t.color
                  ? (FAMILY_TAB_ACTIVE[t.color] ?? PRIMARY_ACTIVE)
                  : PRIMARY_ACTIVE

                return (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    style={{
                      padding: '4px 10px',
                      fontSize: 10,
                      borderRadius: 9999,
                      border: '1px solid',
                      fontWeight: 500,
                      opacity: isDim ? 0.4 : 1,
                      transition: 'opacity 0.15s',
                      // Reset shadcn default active styles; we use inline styles
                      boxShadow: 'none',
                      ...(isActive ? activeStyle : inactiveStyle),
                    }}
                  >
                    {t.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        )}

        {/* Search input + pin */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                position: 'absolute',
                left: 8,
                color: 'hsl(var(--muted-foreground))',
                fontSize: 10,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              &#128269;
            </span>
            <Input
              type="text"
              placeholder={pending ? 'search basic keys' : 'search keycodes'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                height: 26,
                paddingLeft: 24,
                paddingRight: 8,
                fontSize: 10,
                width: 130,
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
            />
            <DetailsStrip hovered={hovered} />
          </div>
        </div>
      )}
    </div>
  )
}
