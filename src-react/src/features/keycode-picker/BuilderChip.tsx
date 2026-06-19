import type { PendingFill } from './templateFill'

interface BuilderChipProps {
  pending: PendingFill
}

function buildLabel(pending: PendingFill): { prefix: string; suffix: string } {
  if (pending.kind === 'LT') {
    const layer = pending.fixed.layer ?? 0
    return { prefix: `LT(${layer}, `, suffix: ')' }
  }
  if (pending.kind === 'MT') {
    const mod = pending.fixed.mod_mask ?? 0
    return { prefix: `MT(0x${mod.toString(16).toUpperCase().padStart(2, '0')}, `, suffix: ')' }
  }
  // LM
  const layer = pending.fixed.layer ?? 0
  return { prefix: `LM(${layer}, `, suffix: ')' }
}

export function BuilderChip({ pending }: BuilderChipProps) {
  const { prefix, suffix } = buildLabel(pending)
  const holeLabel = pending.hole === 'tap' ? 'tap key' : 'mod'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10,
        background: '#fffbea',
        border: '1px solid #ecc94b',
        borderRadius: 9999,
        padding: '3px 10px',
        color: '#744210',
        fontFamily: '"JetBrains Mono", monospace',
        whiteSpace: 'nowrap',
      }}
    >
      {prefix}
      <span
        data-testid="builder-hole"
        style={{
          color: '#b7791f',
          border: '1px dashed #d69e2e',
          borderRadius: 3,
          padding: '0 5px',
          fontSize: 9,
          background: '#fffbea',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        {holeLabel}
      </span>
      {suffix}
    </span>
  )
}
