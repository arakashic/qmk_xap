import { create } from 'zustand'

interface UiState {
  activeDeviceId: string | null
  selectedLayer: number
  setActiveDevice: (id: string) => void
  setLayer: (n: number) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeDeviceId: null,
  selectedLayer: 0,
  setActiveDevice: (id) => set({ activeDeviceId: id, selectedLayer: 0 }),
  setLayer: (n) => set({ selectedLayer: n }),
}))
