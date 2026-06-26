import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PrefsState {
  /** id of the physical keyboard layout for the Basic-keys picker. */
  basicLayout: string
  setBasicLayout: (id: string) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      basicLayout: 'ansi',
      setBasicLayout: (id) => set({ basicLayout: id }),
    }),
    { name: 'xap-prefs' },
  ),
)
