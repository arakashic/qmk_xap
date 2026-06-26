import { useDevtoolsStore } from '../store/devtools'
import { useUiStore } from '../store/ui'
import { useDevices } from '../queries/devices'
import { secureToggleLabel } from '@/features/devices/secureToggle'

export function DevtoolsStrip() {
  const { entries, dockOpen, setDockOpen } = useDevtoolsStore()
  const activeDeviceId = useUiStore((s) => s.activeDeviceId)
  const { data: devices } = useDevices()

  const last = entries.at(-1)
  const activeDevice = devices?.find((d) => d.id === activeDeviceId)
  // Three-state: 🔓 only when actually Unlocked; Unlocking is still locked. The
  // LED dot (green / orange / dark-red) distinguishes the mid-transition state.
  const secure = activeDevice ? secureToggleLabel(activeDevice.secureStatus) : null
  const lockGlyph = activeDevice?.secureStatus === 'Unlocked' ? '🔓' : '🔒'

  return (
    <div
      onClick={() => setDockOpen(!dockOpen)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--strip)',
        color: 'var(--strip-fg)',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
        padding: '6px 12px',
        flexShrink: 0,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span>{dockOpen ? '▲' : '▼'} devtools</span>
      <span style={{ color: 'var(--strip-accent)' }}>⚡ {entries.length}</span>
      <span>{last ? `last: ${last.label}` : 'ready'}</span>
      {activeDevice && (
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            title={secure?.label}
            style={{ width: 6, height: 6, borderRadius: '50%', background: secure?.color, flexShrink: 0 }}
          />
          {lockGlyph} {activeDevice.product}
        </span>
      )}
    </div>
  )
}
