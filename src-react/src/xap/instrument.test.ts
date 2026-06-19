import { describe, it, expect, vi } from 'vitest'
import { instrumentClient } from './instrument'
import { MockXapClient } from './mock/client'

describe('instrumentClient', () => {
  it('records a pending call then resolves ok with latency on success', async () => {
    const calls: unknown[] = []
    const sink = {
      pushCall: (l: string) => { calls.push(['push', l]); return 'id1' },
      resolveCall: (id: string, st: string, ms: unknown) => calls.push(['resolve', id, st, typeof ms]),
    }
    const wrapped = instrumentClient(new MockXapClient(), sink)
    const [d] = await wrapped.listDevices()
    // Use valid ugo fixture coordinate: layer 0, row 3 (matrix y=3), col 3 (matrix x=3) = KC_A
    await wrapped.remapKey(d.id, { layer: 0, row: 3, column: 3 }, { key: 'KC_X', label: 'X' })
    expect(calls).toContainEqual(['resolve', 'id1', 'ok', 'number'])
    expect(calls.find((c) => Array.isArray(c) && c[0] === 'push' && /remapKey/.test(c[1] as string))).toBeTruthy()
  })

  it('records error + re-throws when the underlying method throws', async () => {
    const sink = { pushCall: () => 'idE', resolveCall: vi.fn() }
    const wrapped = instrumentClient(new MockXapClient(), sink)
    await expect(wrapped.getDeviceState('nope')).rejects.toThrow()
    expect(sink.resolveCall).toHaveBeenCalledWith('idE', 'error', expect.any(Number))
  })

  it('passes subscribe through unchanged', () => {
    const mock = new MockXapClient()
    const sink = { pushCall: vi.fn(), resolveCall: vi.fn() }
    const wrapped = instrumentClient(mock, sink)
    const received: unknown[] = []
    const unsub = wrapped.subscribe((e) => received.push(e))
    expect(typeof unsub).toBe('function')
    expect(sink.pushCall).not.toHaveBeenCalled()
  })
})
