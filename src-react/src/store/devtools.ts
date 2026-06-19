import { create } from 'zustand'

export type EntryKind = 'call' | 'secure' | 'log' | 'broadcast' | 'device'

export interface TimelineEntry {
  id: string
  ts: number
  kind: EntryKind
  label: string
  status?: 'pending' | 'ok' | 'error'
  latencyMs?: number
}

interface DevtoolsState {
  entries: TimelineEntry[]
  dockOpen: boolean
  paused: boolean
  hidden: EntryKind[]
  pushCall(label: string): string
  resolveCall(id: string, status: 'ok' | 'error', latencyMs: number): void
  pushEntry(kind: EntryKind, label: string): void
  clear(): void
  togglePause(): void
  setDockOpen(open: boolean): void
  toggleKind(kind: EntryKind): void
}

let nextId = 0

export const useDevtoolsStore = create<DevtoolsState>((set, get) => ({
  entries: [],
  dockOpen: false,
  paused: false,
  hidden: [],

  pushCall: (label) => {
    if (get().paused) return ''
    const id = String(nextId++)
    const entry: TimelineEntry = { id, ts: Date.now(), kind: 'call', label, status: 'pending' }
    set((s) => ({ entries: [...s.entries, entry].slice(-500) }))
    return id
  },

  resolveCall: (id, status, latencyMs) => {
    set((s) => ({
      entries: s.entries.map((e) => e.id === id ? { ...e, status, latencyMs } : e),
    }))
  },

  pushEntry: (kind, label) => {
    if (get().paused) return
    const entry: TimelineEntry = { id: String(nextId++), ts: Date.now(), kind, label }
    set((s) => ({ entries: [...s.entries, entry].slice(-500) }))
  },

  clear: () => set({ entries: [] }),

  togglePause: () => set((s) => ({ paused: !s.paused })),

  setDockOpen: (open) => set({ dockOpen: open }),

  toggleKind: (kind) =>
    set((s) => ({
      hidden: s.hidden.includes(kind)
        ? s.hidden.filter((k) => k !== kind)
        : [...s.hidden, kind],
    })),
}))
