import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from './ui'
import { usePickerStore } from './picker'

beforeEach(() => {
  useUiStore.setState({ activeDeviceId: null, selectedLayer: 0, route: 'keymap' })
  usePickerStore.getState().reset()
})

describe('setActiveDevice', () => {
  it('resets the picker when switching to a different device', () => {
    useUiStore.getState().setActiveDevice('devA')
    // Open the picker against a target on device A.
    usePickerStore.getState().open({ kind: 'key', layer: 2, row: 1, column: 3 })
    expect(usePickerStore.getState().target).not.toBeNull()
    expect(usePickerStore.getState().dockOpen).toBe(true)

    useUiStore.getState().setActiveDevice('devB')

    expect(usePickerStore.getState().target).toBeNull()
    expect(usePickerStore.getState().pending).toBeNull()
    expect(usePickerStore.getState().dockOpen).toBe(false)
    expect(useUiStore.getState().selectedLayer).toBe(0)
  })

  it('does not reset the picker when re-selecting the same device', () => {
    useUiStore.getState().setActiveDevice('devA')
    usePickerStore.getState().open({ kind: 'key', layer: 0, row: 0, column: 0 })
    useUiStore.getState().setActiveDevice('devA')
    expect(usePickerStore.getState().target).not.toBeNull()
  })
})
