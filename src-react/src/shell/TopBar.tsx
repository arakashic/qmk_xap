// Top bar: centered device chip + secure-status button (display-only this plan)
import type { DeviceSummary } from '@/xap/client'

interface TopBarProps {
  device: DeviceSummary | null
}

export function TopBar({ device }: TopBarProps) {
  const isUnlocked = device?.secureStatus === 'Unlocked'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderBottom: '1px solid hsl(var(--border))',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid hsl(var(--border))',
          borderRadius: 'calc(var(--radius) - 2px)',
          background: 'hsl(var(--background))',
          padding: '5px 10px',
          fontSize: 11,
          fontWeight: 500,
          color: 'hsl(var(--foreground))',
          boxShadow: '0 1px 2px rgb(0 0 0 / .04)',
        }}
      >
        ⌨ {device ? device.product : 'No device'}
      </span>
      {device && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 26,
            padding: '0 9px',
            fontSize: 10,
            fontWeight: 500,
            borderRadius: 'calc(var(--radius) - 2px)',
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--background))',
            boxShadow: '0 1px 2px rgb(0 0 0 / .04)',
            color: 'hsl(var(--foreground))',
          }}
        >
          {isUnlocked && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'hsl(142 71% 45%)',
                flexShrink: 0,
              }}
            />
          )}
          {device.secureStatus}
        </span>
      )}
    </div>
  )
}
