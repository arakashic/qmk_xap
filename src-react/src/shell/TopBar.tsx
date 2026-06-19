// Top bar: centered device chip + secure-status toggle for the active device
import type { DeviceSummary } from '@/xap/client'
import { Button } from '@/components/ui/button'
import { secureToggleLabel } from '@/features/devices/secureToggle'
import { useSecureLock, useSecureUnlock } from '@/queries/devices'

interface TopBarProps {
  device: DeviceSummary | null
}

function SecureToggle({ device }: { device: DeviceSummary }) {
  const secureLock = useSecureLock(device.id)
  const secureUnlock = useSecureUnlock(device.id)
  const { label, disabled } = secureToggleLabel(device.secureStatus)

  function handleToggle() {
    if (device.secureStatus === 'Unlocked') {
      secureLock.mutate()
    } else if (device.secureStatus === 'Locked') {
      secureUnlock.mutate()
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={handleToggle}
      style={{ fontSize: 11, height: 26, padding: '0 9px' }}
    >
      {label}
    </Button>
  )
}

export function TopBar({ device }: TopBarProps) {
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
      {device && <SecureToggle device={device} />}
    </div>
  )
}
