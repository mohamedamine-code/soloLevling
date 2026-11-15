import { useEffect, useState, type ReactNode } from 'react'
import { useThemeStore } from '@/stores/theme-store'

/**
 * Applies the resolved theme to the document root by toggling the `dark`
 * class, and keeps following the OS preference when mode is "system".
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const mode = useThemeStore((state) => state.mode)
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent): void => {
      setPrefersDark(event.matches)
    }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [mode, prefersDark])

  return <>{children}</>
}
