import { create } from 'zustand'
import type { PickerTarget, PendingFill } from '@/features/keycode-picker/templateFill'

interface PickerState {
  dockOpen: boolean
  dockPinned: boolean
  target: PickerTarget | null
  pending: PendingFill | null
  activeTab: string
  query: string
  open(target: PickerTarget): void
  close(): void
  /** Clear the selected target without touching the pin preference. */
  deselect(): void
  togglePin(): void
  setTab(id: string): void
  setQuery(q: string): void
  setPending(p: PendingFill | null): void
  /** Clear all selection state on device switch (keeps the pin preference). */
  reset(): void
}

export const usePickerStore = create<PickerState>((set) => ({
  dockOpen: false,
  dockPinned: false,
  target: null,
  pending: null,
  activeTab: 'basic',
  query: '',
  open: (target) => set({ dockOpen: true, target, pending: null, query: '' }),
  close: () => set((s) => s.dockPinned ? s : { dockOpen: false, target: null, pending: null }),
  deselect: () => set((s) => ({ target: null, pending: null, dockOpen: s.dockPinned })),
  togglePin: () => set((s) => ({ dockPinned: !s.dockPinned })),
  setTab: (id) => set({ activeTab: id, query: '' }),
  setQuery: (q) => set({ query: q }),
  setPending: (p) => set({ pending: p }),
  reset: () => set({ dockOpen: false, target: null, pending: null, query: '', activeTab: 'basic' }),
}))
