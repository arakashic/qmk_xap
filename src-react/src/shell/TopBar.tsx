// Top bar: centered device chip (Select dropdown) + secure-status toggle for the active device
import type { DeviceSummary } from '@/xap/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { secureToggleLabel } from '@/features/devices/secureToggle'
import { useDevices, useSecureLock, useSecureUnlock } from '@/queries/devices'
import { useUiStore } from '@/store/ui'

interface TopBarProps {
  device: DeviceSummary | null
}

function SecureToggle({ device }: { device: DeviceSummary }) {
  const secureLock = useSecureLock(device.id)
  const secureUnlock = useSecureUnlock(device.id)
  const { label, disabled, title, color } = secureToggleLabel(device.secureStatus)

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
      title={title}
      style={{ fontSize: 11, height: 26, padding: '0 9px', display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: color, color }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}`, flexShrink: 0 }}
      />
      {label}
    </Button>
  )
}

export function TopBar({ device }: TopBarProps) {
  const { data: devices } = useDevices()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId) ?? undefined
  // Only disabled when devices have loaded and the list is empty
  const noDevices = Array.isArray(devices) && devices.length === 0

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
      <Select
        value={activeDeviceId}
        onValueChange={(id) => useUiStore.getState().setActiveDevice(id)}
        disabled={noDevices}
      >
        <SelectTrigger
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid hsl(var(--border))',
            borderRadius: 'calc(var(--radius) - 2px)',
            background: 'hsl(var(--background))',
            padding: '0 10px',
            fontSize: 11,
            fontWeight: 500,
            color: 'hsl(var(--foreground))',
            boxShadow: '0 1px 2px rgb(0 0 0 / .04)',
            height: 30,
            width: 'auto',
            minWidth: 180,
          }}
        >
          <span aria-hidden style={{ flexShrink: 0 }}>⌨</span>
          {/* Show product from prop immediately (before query resolves); SelectValue takes over once items load */}
          {device ? device.product : (noDevices ? 'No device' : null)}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(devices ?? []).map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.product}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {device && <SecureToggle device={device} />}
    </div>
  )
}
