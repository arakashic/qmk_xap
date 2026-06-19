import { beforeEach, it, expect } from 'vitest'
import { useDevtoolsStore } from './devtools'

beforeEach(() => {
  useDevtoolsStore.setState({
    entries: [],
    dockOpen: false,
    paused: false,
    hidden: [],
  })
})

it('pushCall appends a pending entry and returns an id; resolveCall updates it', () => {
  const s = useDevtoolsStore.getState()
  const id = s.pushCall('remapKey · L0 r2 c3')
  expect(id).not.toBe('')
  let e = useDevtoolsStore.getState().entries.at(-1)!
  expect(e).toMatchObject({ kind: 'call', status: 'pending', label: 'remapKey · L0 r2 c3' })
  useDevtoolsStore.getState().resolveCall(id, 'ok', 12)
  e = useDevtoolsStore.getState().entries.find((x) => x.id === id)!
  expect(e.status).toBe('ok')
  expect(e.latencyMs).toBe(12)
})

it('paused: pushCall is a no-op returning empty id; pushEntry drops', () => {
  useDevtoolsStore.getState().togglePause()
  expect(useDevtoolsStore.getState().pushCall('x')).toBe('')
  useDevtoolsStore.getState().pushEntry('log', 'y')
  expect(useDevtoolsStore.getState().entries.length).toBe(0)
})

it('caps at 500 entries (drops oldest)', () => {
  for (let i = 0; i < 520; i++) useDevtoolsStore.getState().pushEntry('broadcast', `b${i}`)
  const es = useDevtoolsStore.getState().entries
  expect(es.length).toBe(500)
  expect(es[0].label).toBe('b20')   // oldest 20 dropped
})

it('toggleKind adds then removes a kind from hidden; clear empties entries', () => {
  useDevtoolsStore.getState().toggleKind('log')
  expect(useDevtoolsStore.getState().hidden).toContain('log')
  useDevtoolsStore.getState().toggleKind('log')
  expect(useDevtoolsStore.getState().hidden).not.toContain('log')
  useDevtoolsStore.getState().pushEntry('call', 'z')
  useDevtoolsStore.getState().clear()
  expect(useDevtoolsStore.getState().entries.length).toBe(0)
})
