import { create } from 'zustand'

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
  setActiveDevice: (id) => set({ activeDeviceId: id, selectedLayer: 0 }),
  setLayer: (n) => set({ selectedLayer: n }),
  setRoute: (r) => set({ route: r }),
}))
