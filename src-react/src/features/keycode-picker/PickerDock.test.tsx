import { render, screen } from '@testing-library/react'
import { DetailsStrip } from './DetailsStrip'
import { BuilderChip } from './BuilderChip'
import type { PendingFill } from './templateFill'

describe('DetailsStrip', () => {
  it('renders empty state when no hovered code', () => {
    render(<DetailsStrip hovered={null} />)
    expect(screen.getByTestId('details-strip')).toBeInTheDocument()
    // Empty state — no key displayed
    expect(screen.queryByTestId('details-key')).toBeNull()
  })

  it('renders key and description when hovered', () => {
    render(
      <DetailsStrip
        hovered={{ key: 'KC_A', label: 'A', description: 'Letter A' }}
      />,
    )
    expect(screen.getByText('KC_A')).toBeInTheDocument()
    expect(screen.getByText(/Letter A/)).toBeInTheDocument()
  })

  it('shows key label only when no description', () => {
    render(<DetailsStrip hovered={{ key: 'KC_B', label: 'B' }} />)
    expect(screen.getByText('KC_B')).toBeInTheDocument()
  })
})

describe('BuilderChip', () => {
  const ltPending: PendingFill = {
    target: { kind: 'key', layer: 0, row: 0, column: 0 },
    kind: 'LT',
    fixed: { layer: 2 },
    hole: 'tap',
  }

  it('renders LT builder string', () => {
    render(<BuilderChip pending={ltPending} />)
    expect(screen.getByText(/LT\(2/)).toBeInTheDocument()
    // The hole placeholder is rendered
    expect(screen.getByTestId('builder-hole')).toBeInTheDocument()
  })

  it('renders MT builder string', () => {
    const mtPending: PendingFill = {
      target: { kind: 'key', layer: 0, row: 0, column: 0 },
      kind: 'MT',
      fixed: { mod_mask: 1 },
      hole: 'tap',
    }
    render(<BuilderChip pending={mtPending} />)
    // MT chip now shows "Ctrl_T( ... )" via modName
    expect(screen.getByText(/Ctrl_T/)).toBeInTheDocument()
  })

  it('renders LM builder string with mod hole', () => {
    const lmPending: PendingFill = {
      target: { kind: 'key', layer: 0, row: 0, column: 0 },
      kind: 'LM',
      fixed: { layer: 3 },
      hole: 'mod',
    }
    render(<BuilderChip pending={lmPending} />)
    expect(screen.getByText(/LM\(3/)).toBeInTheDocument()
  })
})
