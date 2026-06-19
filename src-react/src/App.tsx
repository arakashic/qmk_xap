import { useEffect } from 'react'
import { Rail } from '@/shell/Rail'
import { TopBar } from '@/shell/TopBar'
import { DevtoolsStrip } from '@/shell/DevtoolsStrip'
import { DevtoolsDock } from '@/features/devtools/DevtoolsDock'
import { KeymapPage } from '@/features/keymap/KeymapPage'
import { DevicesPage } from '@/features/devices/DevicesPage'
import { useUiStore } from '@/store/ui'
import { useDevices } from '@/queries/devices'

export default function App() {
  const { data: devices } = useDevices()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const setActiveDevice = useUiStore((s) => s.setActiveDevice)
  const route = useUiStore((s) => s.route)
  const setRoute = useUiStore((s) => s.setRoute)

  // Default to first device on mount
  useEffect(() => {
    if (!activeDeviceId && devices && devices.length > 0) {
      setActiveDevice(devices[0].id)
    }
  }, [devices, activeDeviceId, setActiveDevice])

  const activeDevice = devices?.find((d) => d.id === activeDeviceId) ?? null

  const showChrome = route !== 'devices'

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
      <Rail active={route} onNavigate={setRoute} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {showChrome && <TopBar device={activeDevice} />}
        {route === 'keymap' && <KeymapPage />}
        {route === 'lighting' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Lighting — coming soon
          </div>
        )}
        {route === 'devices' && <DevicesPage />}
        <DevtoolsDock />
        {showChrome && <DevtoolsStrip />}
      </div>
    </div>
  )
}
