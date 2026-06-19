import { describe, it, expect } from 'vitest'
import { eventToEntry } from './eventToEntry'

describe('eventToEntry', () => {
  it('SecureStatusChanged -> kind=secure, label contains status', () => {
    const r = eventToEntry({ kind: 'SecureStatusChanged', data: { id: 'dev1', secure_status: 'Locked' } })
    expect(r.kind).toBe('secure')
    expect(r.label).toContain('Locked')
  })

  it('SecureStatusChanged Unlocked', () => {
    const r = eventToEntry({ kind: 'SecureStatusChanged', data: { id: 'dev1', secure_status: 'Unlocked' } })
    expect(r.kind).toBe('secure')
    expect(r.label).toBe('secure -> Unlocked')
  })

  it('LogReceived -> kind=log, label contains the log string', () => {
    const r = eventToEntry({ kind: 'LogReceived', data: { id: 'dev1', log: 'hello world' } })
    expect(r.kind).toBe('log')
    expect(r.label).toContain('hello world')
  })

  it('RawBroadcastReceived -> kind=broadcast, label contains type and payload length', () => {
    const r = eventToEntry({
      kind: 'RawBroadcastReceived',
      data: { id: 'dev1', broadcast_type: 'Keyboard', payload: [1, 2, 3, 4] },
    })
    expect(r.kind).toBe('broadcast')
    expect(r.label).toContain('Keyboard')  // broadcast_type
    expect(r.label).toContain('4B')        // payload.length
  })

  it('NewDevice -> kind=device, label contains + and id', () => {
    const r = eventToEntry({ kind: 'NewDevice', data: { id: 'abc123' } })
    expect(r.kind).toBe('device')
    expect(r.label).toContain('+')
    expect(r.label).toContain('abc123')
  })

  it('RemovedDevice -> kind=device, label contains - and id', () => {
    const r = eventToEntry({ kind: 'RemovedDevice', data: { id: 'abc123' } })
    expect(r.kind).toBe('device')
    expect(r.label).toContain('-')
    expect(r.label).toContain('abc123')
  })
})
