import { useDevices, useDeviceState } from '@/queries/devices'
import { useUiStore } from '@/store/ui'
import { DeviceCard } from './DeviceCard'

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

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: 18 }}>
      {devices?.map((d) => (
        <DeviceCardContainer key={d.id} id={d.id} isActive={d.id === activeDeviceId} />
      ))}
    </div>
  )
}
