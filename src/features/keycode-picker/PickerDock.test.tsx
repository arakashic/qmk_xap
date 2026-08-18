import { render, screen } from '@testing-library/react'
import { BuilderChip } from './BuilderChip'
import type { PendingFill } from './templateFill'

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
