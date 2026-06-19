// Nav rail: dark --rail background, icon+label items, active=blue

type Section = 'keymap' | 'lighting' | 'devices'

interface RailProps {
  active: Section
  onNavigate?: (s: Section) => void
}

const ITEMS: { id: Section; icon: string; label: string }[] = [
  { id: 'keymap',   icon: '⌨',  label: 'Keymap'  },
  { id: 'lighting', icon: '🌈', label: 'Light'   },
  { id: 'devices',  icon: '🖥', label: 'Devices' },
]

export function Rail({ active, onNavigate }: RailProps) {
  return (
    <nav
      style={{
        width: 64,
        flexShrink: 0,
        background: 'var(--rail)',
        borderRight: '1px solid #232c3a',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px',
      }}
    >
      {ITEMS.map((item) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '8px 4px',
              borderRadius: 'calc(var(--radius) - 2px)',
              fontSize: 9,
              fontWeight: 500,
              color: isActive ? 'hsl(var(--primary-foreground))' : 'var(--rail-fg)',
              background: isActive ? 'hsl(var(--primary))' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
