import { useEffect, useState } from 'react'
import { Rail } from '@/shell/Rail'
import { TopBar } from '@/shell/TopBar'
import { DevtoolsStrip } from '@/shell/DevtoolsStrip'
import { DevtoolsDock } from '@/features/devtools/DevtoolsDock'
import { useDevtoolsSubscription } from '@/features/devtools/useDevtoolsSubscription'
import { useDeviceSync } from '@/queries/useDeviceSync'
import { KeymapPage } from '@/features/keymap/KeymapPage'
import { LightingPage } from '@/features/lighting/LightingPage'
import { DevicesPage } from '@/features/devices/DevicesPage'
import { DeviceLanding } from '@/features/devices/DeviceLanding'
import { useUiStore } from '@/store/ui'
import { useDevtoolsStore } from '@/store/devtools'
import { useDevices } from '@/queries/devices'
import { activeClientKind } from '@/xap/runtime'
import { initWebTransport } from '@/xap/web/web-client'

// How long an empty device list reads as "still arriving" before settling to
// "No keyboard connected." Covers the desktop hotplug enumeration (~1s after
// startup) so the arrival window doesn't flash as a failure.
const SEARCH_GRACE_MS = 2000

export default function App() {
  const { data: devices, isLoading, isError } = useDevices()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const setActiveDevice = useUiStore((s) => s.setActiveDevice)
  const route = useUiStore((s) => s.route)
  const setRoute = useUiStore((s) => s.setRoute)
  const dockOpen = useDevtoolsStore((s) => s.dockOpen)

  useDevtoolsSubscription()
  useDeviceSync()

  // Activate the web passive-arrival path (getDevices reattach + 'connect'
  // listener) once on mount; no-op on desktop/mock.
  useEffect(() => {
    if (activeClientKind() === 'web') initWebTransport()
  }, [])

  const [graceElapsed, setGraceElapsed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGraceElapsed(true), SEARCH_GRACE_MS)
    return () => clearTimeout(t)
  }, [])

  const ready = devices?.filter((d) => d.status === 'ready') ?? []
  const pending = devices?.filter((d) => d.status === 'connecting' || d.status === 'interrogating') ?? []
  const failed = devices?.filter((d) => d.status === 'failed') ?? []

  // Default to first ready device on mount
  useEffect(() => {
    if (!activeDeviceId && ready.length > 0) {
      setActiveDevice(ready[0].id)
    }
  }, [ready, activeDeviceId, setActiveDevice])

  const activeDevice = ready.find((d) => d.id === activeDeviceId) ?? null

  const showChrome = route !== 'devices'

  // A browser without WebHID has no real transport — say so instead of silently
  // showing mock fixtures as if they were real devices.
  if (activeClientKind() === 'unsupported') {
    return <DeviceLanding searching={false} errored={false} pending={[]} failed={[]} unsupported />
  }

  // Nothing usable yet → a full-screen lifecycle landing instead of the normal
  // layout. Distinguish first-load/arrival (searching), a handshake in progress
  // (connecting), a failed interrogation, and a genuinely empty list.
  if (ready.length === 0) {
    const searching = isLoading || (!isError && pending.length === 0 && failed.length === 0 && !graceElapsed)
    return <DeviceLanding searching={searching} errored={isError} pending={pending} failed={failed} />
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
