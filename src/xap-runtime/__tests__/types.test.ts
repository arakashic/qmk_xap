import { describe, it, expect } from 'vitest'
import { runtime } from '@/xap-runtime'

describe('xap-runtime', () => {
    it('exposes capabilities, commands, and lifecycle methods', () => {
        expect(runtime.capabilities).toBeDefined()
        // The selected runtime depends on the host (Tauri vs browser); assert the
        // capability shape rather than a host-specific value.
        expect(typeof runtime.capabilities.requiresUserConnect).toBe('boolean')
        expect(runtime.commands).toBeDefined()
        expect(typeof runtime.connectDevice).toBe('function')
        expect(typeof runtime.addEventListener).toBe('function')
        expect(typeof runtime.clearEventListener).toBe('function')
    })
})
