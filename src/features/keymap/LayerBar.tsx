// Segmented layer control: blue active pill, drives useUiStore.selectedLayer
import { useUiStore } from '@/store/ui'

interface LayerBarProps {
  layerCount: number
}

export function LayerBar({ layerCount }: LayerBarProps) {
  const selectedLayer = useUiStore((s) => s.selectedLayer)
  const setLayer = useUiStore((s) => s.setLayer)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          gap: 2,
          background: 'hsl(var(--muted))',
          borderRadius: 'calc(var(--radius) - 2px)',
          padding: 3,
        }}
      >
        {Array.from({ length: layerCount }, (_, i) => {
          const isActive = i === selectedLayer
          return (
            <button
              key={i}
              onClick={() => setLayer(i)}
              style={{
                border: 'none',
                background: isActive ? 'hsl(var(--primary))' : 'transparent',
                borderRadius: 'calc(var(--radius) - 4px)',
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 500,
                color: isActive
                  ? 'hsl(var(--primary-foreground))'
                  : 'hsl(var(--muted-foreground))',
                boxShadow: isActive ? '0 1px 2px rgb(0 0 0 / .12)' : 'none',
                cursor: 'pointer',
              }}
            >
              L{i}
            </button>
          )
        })}
      </span>
    </div>
  )
}
