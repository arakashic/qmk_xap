import { describe, it, expect } from 'vitest'
import { runtime } from '@/xap-runtime'

describe('xap-runtime', () => {
    it('exposes capabilities, commands, and lifecycle methods', () => {
        expect(runtime.capabilities).toBeDefined()
        expect(runtime.capabilities.requiresUserConnect).toBe(false)
        expect(runtime.commands).toBeDefined()
        expect(typeof runtime.connectDevice).toBe('function')
        expect(typeof runtime.addEventListener).toBe('function')
        expect(typeof runtime.clearEventListener).toBe('function')
    })
})
