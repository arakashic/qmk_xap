import type { TimelineEntry, EntryKind } from '../../store/devtools'

const KIND_COLOR: Record<EntryKind, string> = {
  call: '#63b3ed',       // blue
  secure: '#fbd38d',     // amber
  log: '#9ae6b4',        // green
  broadcast: '#b794f4',  // purple
  device: '#fc8181',     // red
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

interface Props {
  entry: TimelineEntry
}

export function TimelineRow({ entry }: Props) {
  const { ts, kind, label, status, latencyMs } = entry
  const dotColor = KIND_COLOR[kind]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 12px',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
        color: '#a0aec0',
        borderBottom: '1px solid #2d3748',
      }}
    >
      <span style={{ color: '#4a5568', flexShrink: 0 }}>{formatTs(ts)}</span>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
        title={kind}
      />
      <span style={{ color: dotColor, flexShrink: 0, fontSize: 9 }}>{kind}</span>
      <span style={{ flex: 1, color: '#cbd5e0' }}>{label}</span>
      {kind === 'call' && (
        <span style={{ flexShrink: 0, color: status === 'ok' ? '#9ae6b4' : status === 'error' ? '#fc8181' : '#4a5568' }}>
          {status === 'pending' ? '…' : status === 'ok' ? `✓ ${latencyMs}ms` : `✗ ${latencyMs ?? '?'}ms`}
        </span>
      )}
    </div>
  )
}
