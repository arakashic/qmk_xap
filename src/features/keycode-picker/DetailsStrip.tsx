import type { KeyCode } from '@/xap/types'

interface DetailsStripProps {
  hovered: KeyCode | null
}

export function DetailsStrip({ hovered }: DetailsStripProps) {
  return (
    <div
      data-testid="details-strip"
      style={{
        background: 'hsl(var(--muted) / 0.6)',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'calc(var(--radius) - 2px)',
        padding: '5px 9px',
        fontSize: 10,
        color: 'hsl(var(--muted-foreground))',
        marginTop: 8,
        minHeight: 26,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {hovered ? (
        <>
          <span
            data-testid="details-key"
            style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500, fontSize: 10 }}
          >
            {hovered.key}
          </span>
          {hovered.description && (
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>
              — {hovered.description}
            </span>
          )}
          {!hovered.description && hovered.label && hovered.label !== hovered.key && (
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>
              — {hovered.label}
            </span>
          )}
        </>
      ) : (
        <span style={{ opacity: 0.5 }}>Hover a key to see details</span>
      )}
    </div>
  )
}
