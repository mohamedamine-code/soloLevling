/**
 * Renderer date utilities. Core local-date logic lives in `shared/utils/date.ts`
 * so the main process (progress engine, widget) and the renderer share one
 * implementation. Renderer-specific formatting stays here.
 */

export {
  toLocalDateKey,
  fromLocalDateKey,
  isLocalDateKey,
  isDateKeyBefore,
  isDateKeyOnOrBefore,
  formatMinutes
} from '@shared/utils/date'

export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening'

export function getGreeting(date: Date = new Date()): Greeting {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** e.g. "Saturday, November 14, 2026" using the user's locale. */
export function formatLongDate(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
