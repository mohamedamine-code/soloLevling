import { useEffect, useState } from 'react'
import { ThemeProvider } from './providers/theme-provider'
import { AppLayout } from '@/components/layout/AppLayout'
import { TodayPage } from '@/features/dashboard/TodayPage'
import { HabitsPage } from '@/features/habits/HabitsPage'
import { RoutinesPage } from '@/features/routines/RoutinesPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useNavigationStore } from '@/stores/navigation-store'

function CurrentView(): React.JSX.Element {
  const activeView = useNavigationStore((state) => state.activeView)
  switch (activeView) {
    case 'today':
      return <TodayPage />
    case 'habits':
      return <HabitsPage />
    case 'routines':
      return <RoutinesPage />
    case 'analytics':
      return <AnalyticsPage />
    case 'history':
      return <HistoryPage />
    case 'settings':
      return <SettingsPage />
  }
}

export function App(): React.JSX.Element {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Small mount transition; purely cosmetic and respects reduced-motion CSS.
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  return (
    <ThemeProvider>
      <div
        className={`h-full transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      >
        <AppLayout>
          <CurrentView />
        </AppLayout>
      </div>
    </ThemeProvider>
  )
}
