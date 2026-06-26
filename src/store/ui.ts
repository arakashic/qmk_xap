import { create } from 'zustand'
import { usePickerStore } from './picker'

export type Route = 'keymap' | 'lighting' | 'devices'

interface UiState {
  activeDeviceId: string | null
  selectedLayer: number
  route: Route
  setActiveDevice: (id: string) => void
  setLayer: (n: number) => void
  setRoute: (r: Route) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeDeviceId: null,
  selectedLayer: 0,
  route: 'keymap',
  setActiveDevice: (id) =>
    set((s) => {
      // Switching keyboards must clear the picker too, else an open dock can keep
      // a pending fill bound to a stale target (old layer/row/col) and complete a
      // write against the new device.
      if (id !== s.activeDeviceId) usePickerStore.getState().reset()
      return { activeDeviceId: id, selectedLayer: 0 }
    }),
  setLayer: (n) => set({ selectedLayer: n }),
  setRoute: (r) => set({ route: r }),
}))
