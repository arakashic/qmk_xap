import { describe, it, expect, vi } from 'vitest'
import { makeWasmCommands } from './wasm-commands'

describe('makeWasmCommands', () => {
  // Regression: getDeviceState must read the wasm's cached state (device_state),
  // never device_get — device_get re-runs the full HID interrogation, so routing
  // it here re-interrogates the keyboard on every ['device', id] refetch (e.g.
  // switching to the Devices page). Interrogation belongs to arrive() alone.
  it('deviceGet reads cached device_state, not device_get', async () => {
    const fake = {
      device_state: vi.fn().mockReturnValue({ id: 'k1' }),
      device_get: vi.fn().mockResolvedValue({ id: 'k1' }),
    }
    const cmds = makeWasmCommands(() => Promise.resolve(fake as never))

    const res = await cmds.deviceGet('k1')

    expect(fake.device_state).toHaveBeenCalledWith('k1')
    expect(fake.device_get).not.toHaveBeenCalled()
    expect(res).toEqual({ status: 'ok', data: { id: 'k1' } })
  })
})
