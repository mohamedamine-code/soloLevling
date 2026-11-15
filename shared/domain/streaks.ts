import type { HabitSchedule, OverallStreak } from '../types'
import { isScheduledOn } from './schedule'
import { addDaysToKey, previousDateKey } from '../utils/date'

/**
 * Streak engine — the single source of streak rules:
 *
 * - Completed scheduled day: streak +1.
 * - Missed scheduled day: breaks the streak.
 * - Unscheduled day: does not count and does not break.
 * - Explicitly skipped day: pauses the streak (does not count, does not break).
 * - Today (if scheduled but not yet completed): does not break the current
 *   streak — the day is still in progress.
 */

export interface DayCountSummary {
  /** Habits due that day (scheduled, not skipped). */
  scheduledCount: number
  /** Of those, habits that reached their target. */
  completedCount: number
}

/**
 * Overall daily streaks from per-day summaries (a calendar date string →
 * summary map is built from an ascending list).
 */
export function computeOverallStreaks(
  summaries: Array<{ date: string } & DayCountSummary>,
  todayKey: string,
  /** earliest key bounds the backward walk for `current`. */
  earliestKey: string
): OverallStreak {
  const byDate = new Map(summaries.map((summary) => [summary.date, summary]))

  // Current streak: walk backward from today.
  let current = 0
  let day = todayKey
  while (day >= earliestKey) {
    const summary = byDate.get(day)
    if (summary && summary.scheduledCount > 0) {
      if (summary.completedCount >= summary.scheduledCount) {
        current += 1
      } else if (day !== todayKey) {
        break
      }
      // Today incomplete: neither count nor break.
    }
    day = previousDateKey(day)
  }

  // Best streak: forward scan over all days in range.
  let best = 0
  let running = 0
  let scan = earliestKey
  while (scan <= todayKey) {
    const summary = byDate.get(scan)
    if (summary && summary.scheduledCount > 0) {
      if (summary.completedCount >= summary.scheduledCount) {
        running += 1
        best = Math.max(best, running)
      } else {
        running = 0
      }
    }
    scan = nextKey(scan)
  }

  return { current, best }
}

function nextKey(key: string): string {
  return addDaysToKey(key, 1)
}

/**
 * Habit-specific streaks. Completion = the habit reached its target that day.
 */
export function computeHabitStreaks(params: {
  schedule: HabitSchedule
  /** Local date keys explicitly skipped. */
  skippedDates: string[]
  /** Local date keys where the habit was completed. */
  completedDates: string[]
  todayKey: string
}): OverallStreak {
  const { schedule, todayKey } = params
  const skipped = new Set(params.skippedDates)
  const completed = new Set(params.completedDates)

  const isCounted = (day: string): boolean =>
    isScheduledOn(schedule, day) && !skipped.has(day)
  const isComplete = (day: string): boolean => completed.has(day)

  // Current streak: walk backward from today within the schedule range.
  let current = 0
  let day = todayKey
  while (day >= schedule.startDate) {
    if (isCounted(day)) {
      if (isComplete(day)) {
        current += 1
      } else if (day !== todayKey) {
        break
      }
    }
    day = previousDateKey(day)
  }

  // Best streak: scan every day from start to today.
  let best = 0
  let running = 0
  let scan = schedule.startDate
  while (scan <= todayKey) {
    if (isCounted(scan)) {
      if (isComplete(scan)) {
        running += 1
        best = Math.max(best, running)
      } else {
        running = 0
      }
    }
    scan = nextKey(scan)
  }

  return { current, best }
}
