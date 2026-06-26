import { create } from 'zustand'
import type { KeyCode } from '@/xap/types'
import type { PickerTarget, PendingFill } from '@/features/keycode-picker/templateFill'

interface PickerState {
  dockOpen: boolean
  dockPinned: boolean
  target: PickerTarget | null
  pending: PendingFill | null
  hovered: KeyCode | null
  activeTab: string
  query: string
  open(target: PickerTarget): void
  close(): void
  togglePin(): void
  setTab(id: string): void
  setQuery(q: string): void
  setHovered(c: KeyCode | null): void
  setPending(p: PendingFill | null): void
  /** Clear all selection state on device switch (keeps the pin preference). */
  reset(): void
}

export const usePickerStore = create<PickerState>((set) => ({
  dockOpen: false,
  dockPinned: false,
  target: null,
  pending: null,
  hovered: null,
  activeTab: 'basic',
  query: '',
  open: (target) => set({ dockOpen: true, target, pending: null, query: '', hovered: null }),
  close: () => set((s) => s.dockPinned ? s : { dockOpen: false, target: null, pending: null }),
  togglePin: () => set((s) => ({ dockPinned: !s.dockPinned })),
  setTab: (id) => set({ activeTab: id, query: '' }),
  setQuery: (q) => set({ query: q }),
  setHovered: (c) => set({ hovered: c }),
  setPending: (p) => set({ pending: p }),
  reset: () => set({ dockOpen: false, target: null, pending: null, hovered: null, query: '', activeTab: 'basic' }),
}))
