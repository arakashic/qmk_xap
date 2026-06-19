import { useRef, useEffect } from 'react'
import { useDevtoolsStore, type EntryKind } from '../../store/devtools'
import { TimelineRow } from './TimelineRow'

const ALL_KINDS: EntryKind[] = ['call', 'secure', 'log', 'broadcast', 'device']

const KIND_COLOR: Record<EntryKind, string> = {
  call: '#63b3ed',
  secure: '#fbd38d',
  log: '#9ae6b4',
  broadcast: '#b794f4',
  device: '#fc8181',
}

export function DevtoolsDock() {
  const { entries, dockOpen, paused, hidden, setDockOpen, togglePause, clear, toggleKind } =
    useDevtoolsStore()
  const bodyRef = useRef<HTMLDivElement>(null)

  // scroll to bottom when entries change
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [entries])

  if (!dockOpen) return null

  const visible = entries.filter((e) => !hidden.includes(e.kind))

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 300,
        background: '#1a202c',
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid #2d3748',
        zIndex: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderBottom: '1px solid #2d3748',
          flexShrink: 0,
        }}
      >
        {/* Filter chips */}
        {ALL_KINDS.map((kind) => {
          const isHidden = hidden.includes(kind)
          return (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                border: `1px solid ${isHidden ? '#2d3748' : KIND_COLOR[kind]}`,
                background: isHidden ? 'transparent' : `${KIND_COLOR[kind]}22`,
                color: isHidden ? '#4a5568' : KIND_COLOR[kind],
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isHidden ? '#4a5568' : KIND_COLOR[kind],
                }}
              />
              {kind}
            </button>
          )
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Controls */}
        <button
          onClick={togglePause}
          title={paused ? 'Resume' : 'Pause'}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: `1px solid ${paused ? '#9ae6b4' : '#4a5568'}`,
            background: paused ? '#9ae6b422' : 'transparent',
            color: paused ? '#9ae6b4' : '#718096',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          {paused ? '▶ resume' : '⏸ pause'}
        </button>
        <button
          onClick={clear}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid #4a5568',
            background: 'transparent',
            color: '#718096',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          clear
        </button>
        <button
          onClick={() => setDockOpen(false)}
          title="Collapse"
          style={{
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid #4a5568',
            background: 'transparent',
            color: '#718096',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          ▼
        </button>
      </div>

      {/* Timeline body */}
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {visible.length === 0 ? (
          <div
            style={{
              padding: '12px',
              color: '#4a5568',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
            }}
          >
            no events
          </div>
        ) : (
          visible.map((entry) => <TimelineRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  )
}
