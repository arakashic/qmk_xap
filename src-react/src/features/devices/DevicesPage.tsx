import { useDevices, useDeviceState } from '@/queries/devices'
import { useUiStore } from '@/store/ui'
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

export function DevicesPage() {
  const { data: devices } = useDevices()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)

  // The no-device case is handled by the app-level connect landing; here the
  // button (web-only) lets you add another keyboard.
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: 18 }}>
      <ConnectDeviceButton />
      {devices?.map((d) => (
        <DeviceCardContainer key={d.id} id={d.id} isActive={d.id === activeDeviceId} />
      ))}
    </div>
  )
}
