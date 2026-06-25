import { useDevices, useDeviceState } from '@/queries/devices'
import { activeClientKind } from '@/xap/runtime'
import { useUiStore } from '@/store/ui'
import type { DeviceSummary } from '@/xap/client'
import { Card } from '@/components/ui/card'
import { DeviceCard } from './DeviceCard'
import { ConnectDeviceButton } from './ConnectDeviceButton'

interface ContainerProps {
  id: string
  isActive: boolean
}

function DeviceCardContainer({ id, isActive }: ContainerProps) {
  const { data: state } = useDeviceState(id)
  if (!state) return null
  return (
    <DeviceCard
      state={state}
      isActive={isActive}
      onSetActive={() => useUiStore.getState().setActiveDevice(id)}
    />
  )
}

// A device still in the connecting/interrogating/failed lifecycle has no full
// state to render a DeviceCard from; show its phase instead of an empty slot.
function PendingDeviceCard({ summary }: { summary: DeviceSummary }) {
  const failed = summary.status === 'failed'
  return (
    <Card style={{ padding: 14, margin: '0 14px 12px', borderRadius: 'var(--radius)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{summary.product}</div>
      <div style={{ fontSize: 11, marginTop: 4, color: failed ? '#c53030' : 'hsl(var(--muted-foreground))' }}>
        {failed ? `Failed: ${summary.error ?? 'interrogation error'}` : `${summary.status}…`}
      </div>
    </Card>
  )
}

export function DevicesPage() {
  const { data: devices } = useDevices()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)

  // The no-device case is handled by the app-level connect landing; here the
  // button (web-only) lets you add another keyboard.
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: 18 }}>
      {activeClientKind() === 'web' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 14px', marginBottom: 18 }}>
          <ConnectDeviceButton />
        </div>
      )}
      {devices?.map((d) =>
        d.status === 'ready' ? (
          <DeviceCardContainer key={d.id} id={d.id} isActive={d.id === activeDeviceId} />
        ) : (
          <PendingDeviceCard key={d.id} summary={d} />
        ),
      )}
    </div>
  )
}
