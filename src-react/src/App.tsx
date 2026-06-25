import { useEffect } from 'react'
import { Rail } from '@/shell/Rail'
import { TopBar } from '@/shell/TopBar'
import { DevtoolsStrip } from '@/shell/DevtoolsStrip'
import { DevtoolsDock } from '@/features/devtools/DevtoolsDock'
import { useDevtoolsSubscription } from '@/features/devtools/useDevtoolsSubscription'
import { useDeviceSync } from '@/queries/useDeviceSync'
import { KeymapPage } from '@/features/keymap/KeymapPage'
import { LightingPage } from '@/features/lighting/LightingPage'
import { DevicesPage } from '@/features/devices/DevicesPage'
import { ConnectDeviceButton } from '@/features/devices/ConnectDeviceButton'
import { useUiStore } from '@/store/ui'
import { useDevtoolsStore } from '@/store/devtools'
import { useDevices } from '@/queries/devices'

export default function App() {
  const { data: devices } = useDevices()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const setActiveDevice = useUiStore((s) => s.setActiveDevice)
  const route = useUiStore((s) => s.route)
  const setRoute = useUiStore((s) => s.setRoute)
  const dockOpen = useDevtoolsStore((s) => s.dockOpen)

  useDevtoolsSubscription()
  useDeviceSync()

  // Default to first device on mount
  useEffect(() => {
    if (!activeDeviceId && devices && devices.length > 0) {
      setActiveDevice(devices[0].id)
    }
  }, [devices, activeDeviceId, setActiveDevice])

  const activeDevice = devices?.find((d) => d.id === activeDeviceId) ?? null

  const showChrome = route !== 'devices'

  // No keyboard connected → a full-screen connect landing, hiding the normal
  // layout. The web app starts empty until the user picks a device via the
  // WebHID chooser; a desktop device auto-enumerates.
  if (devices && devices.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsl(var(--background))',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'hsl(var(--muted-foreground))' }}>
          <div style={{ fontSize: 14 }}>No keyboard connected.</div>
          <ConnectDeviceButton />
        </div>
      </div>
    )
  }

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
        {route === 'lighting' && <LightingPage />}
        {route === 'devices' && <DevicesPage />}
        {showChrome && dockOpen && <DevtoolsDock />}
        {showChrome && <DevtoolsStrip />}
      </div>
    </div>
  )
}
