import type { HabitSchedule } from '../types'
import { fromLocalDateKey, isLocalDateKey } from '../utils/date'

/**
 * Scheduling domain logic. Single source of truth for "is this habit due on
 * this day?" — used by the dashboard, the progress engine (Phase 3), and the
 * widget. Never duplicate this predicate.
 */

/**
 * Whether a habit's schedule makes it due on the given local date key
 * (`YYYY-MM-DD`). Date-range bounds are inclusive. This does NOT consider
 * archived status or skip overrides — callers handle those separately.
 */
export function isScheduledOn(schedule: HabitSchedule, dateKey: string): boolean {
  if (!isLocalDateKey(dateKey)) {
    throw new Error(`Invalid local date key: ${dateKey}`)
  }
  if (schedule.startDate > dateKey) return false
  if (schedule.endDate !== null && schedule.endDate < dateKey) return false

  if (schedule.type === 'daily') return true

  const date = fromLocalDateKey(dateKey)
  return schedule.weekdays.includes(date.getDay())
}

/** Short label for a weekday number (0 = Sunday). */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
