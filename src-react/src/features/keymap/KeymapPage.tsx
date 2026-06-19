import { useUiStore } from '@/store/ui'
import { useMappedKeymap } from '@/queries/devices'
import { Board } from './Board'
import { LayerBar } from './LayerBar'

export function KeymapPage() {
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const selectedLayer = useUiStore((s) => s.selectedLayer)
  const { data: keymap, isLoading } = useMappedKeymap(activeDeviceId)

  if (!activeDeviceId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
          fontSize: 12,
        }}
      >
        No device selected
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
          fontSize: 12,
        }}
      >
        Loading keymap…
      </div>
    )
  }

  if (!keymap) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(var(--muted-foreground))',
          fontSize: 12,
        }}
      >
        No keymap data
      </div>
    )
  }

  const layerCount = keymap.keys.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <LayerBar layerCount={layerCount} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <Board keymap={keymap} layer={selectedLayer} />
      </div>
    </div>
  )
}
