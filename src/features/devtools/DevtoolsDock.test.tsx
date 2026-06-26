import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach } from 'vitest'
import { useDevtoolsStore } from '../../store/devtools'
import { DevtoolsDock } from './DevtoolsDock'

beforeEach(() => {
  useDevtoolsStore.setState({
    entries: [
      { id: '1', ts: Date.now(), kind: 'call', label: 'remapKey L0 r0 c0', status: 'ok', latencyMs: 5 },
      { id: '2', ts: Date.now(), kind: 'log', label: 'log: boot complete' },
      { id: '3', ts: Date.now(), kind: 'broadcast', label: 'broadcast 1 [4B]' },
      { id: '4', ts: Date.now(), kind: 'secure', label: 'secure -> Locked' },
      { id: '5', ts: Date.now(), kind: 'device', label: 'device + abc123' },
    ],
    dockOpen: true,
    paused: false,
    hidden: [],
  })
})

it('renders timeline rows for all entries when dock is open', () => {
  render(<DevtoolsDock />)
  expect(screen.getByText(/remapKey L0 r0 c0/)).toBeInTheDocument()
  expect(screen.getByText(/log: boot complete/)).toBeInTheDocument()
  expect(screen.getByText(/broadcast 1 \[4B\]/)).toBeInTheDocument()
  expect(screen.getByText(/secure -> Locked/)).toBeInTheDocument()
  expect(screen.getByText(/device \+ abc123/)).toBeInTheDocument()
})

it('renders nothing when dockOpen is false', () => {
  useDevtoolsStore.setState({ dockOpen: false })
  const { container } = render(<DevtoolsDock />)
  expect(container).toBeEmptyDOMElement()
})

it('toggling a kind chip hides entries of that kind', () => {
  render(<DevtoolsDock />)
  // Click the 'log' chip button (there are multiple "log" texts; find the button)
  const logChip = screen.getAllByText('log').find(
    (el) => el.closest('button') !== null,
  )!
  fireEvent.click(logChip.closest('button')!)
  expect(useDevtoolsStore.getState().hidden).toContain('log')
  // log entry row should no longer be visible
  expect(screen.queryByText(/log: boot complete/)).toBeNull()
})

it('Pause and Clear buttons are present', () => {
  render(<DevtoolsDock />)
  expect(screen.getByText(/pause/i)).toBeInTheDocument()
  expect(screen.getByText(/clear/i)).toBeInTheDocument()
})

it('collapse button calls setDockOpen(false)', () => {
  render(<DevtoolsDock />)
  fireEvent.click(screen.getByTitle('Collapse'))
  expect(useDevtoolsStore.getState().dockOpen).toBe(false)
})

it('clear button empties entries', () => {
  render(<DevtoolsDock />)
  fireEvent.click(screen.getByText('clear'))
  expect(useDevtoolsStore.getState().entries.length).toBe(0)
})

it('pause button toggles paused state', () => {
  render(<DevtoolsDock />)
  fireEvent.click(screen.getByText(/pause/i))
  expect(useDevtoolsStore.getState().paused).toBe(true)
})

it('resolved call row shows latency rounded to one decimal', () => {
  useDevtoolsStore.setState({
    entries: [
      { id: '1', ts: Date.now(), kind: 'call', label: 'remapKey', status: 'ok', latencyMs: 2.7000000029802322 },
    ],
    dockOpen: true,
    paused: false,
    hidden: [],
  })
  render(<DevtoolsDock />)
  expect(screen.getByText(/✓ 2\.7ms/)).toBeInTheDocument()
})
