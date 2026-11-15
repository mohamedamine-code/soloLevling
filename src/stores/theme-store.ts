import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

/**
 * Theme preference store. Persisted locally so the app reopens with the
 * user's chosen appearance.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      setMode: (mode) => set({ mode })
    }),
    { name: 'sololeving-theme' }
  )
)

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): 'dark' | 'light' {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}
