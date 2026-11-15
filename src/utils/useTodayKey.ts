import { useEffect, useState } from 'react'
import { toLocalDateKey } from '@shared/utils/date'

const DAY_CHECK_INTERVAL_MS = 30_000

/**
 * The current local date key, re-evaluated every 30 seconds so long-running
 * sessions roll over to the new day automatically (Today dashboard, widget).
 * Pages keyed by this value remount/refetch when midnight passes.
 */
export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => toLocalDateKey(new Date()))

  useEffect(() => {
    const id = window.setInterval(() => {
      const key = toLocalDateKey(new Date())
      setTodayKey((current) => (current === key ? current : key))
    }, DAY_CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return todayKey
}
