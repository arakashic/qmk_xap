// Devtools strip: dark --strip background, display-only this plan

export function DevtoolsStrip() {
  return (
    <div
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
      }}
    >
      <span>▼ devtools</span>
      <span style={{ color: 'var(--strip-accent)' }}>⚡ ready</span>
      <span>mock client active</span>
    </div>
  )
}
