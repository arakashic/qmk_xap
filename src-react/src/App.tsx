import { useEffect } from 'react'
import { Rail } from '@/shell/Rail'
import { TopBar } from '@/shell/TopBar'
import { DevtoolsStrip } from '@/shell/DevtoolsStrip'
import { KeymapPage } from '@/features/keymap/KeymapPage'
import { useUiStore } from '@/store/ui'
import { useDevices } from '@/queries/devices'

export default function App() {
  const { data: devices } = useDevices()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const setActiveDevice = useUiStore((s) => s.setActiveDevice)

  // Default to first device on mount
  useEffect(() => {
    if (!activeDeviceId && devices && devices.length > 0) {
      setActiveDevice(devices[0].id)
    }
  }, [devices, activeDeviceId, setActiveDevice])

  const activeDevice = devices?.find((d) => d.id === activeDeviceId) ?? null

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'hsl(var(--background))',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: 12,
      }}
    >
      <Rail active="keymap" />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <TopBar device={activeDevice} />
        <KeymapPage />
        <DevtoolsStrip />
      </div>
    </div>
  )
}
