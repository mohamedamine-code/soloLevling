import type { Habit, HabitDayStatus, HabitEntry, DayProgress } from '../types'
import { isScheduledOn } from './schedule'

/**
 * Daily progress engine — the single source of progress formulas.
 *
 * Dashboard, floating widget, and analytics MUST all consume these functions.
 * Never duplicate the math elsewhere.
 */

/** Whether the habit counts on the given day: active and scheduled. */
export function isHabitCountedOn(habit: Habit, dateKey: string): boolean {
  return habit.archivedAt === null && isScheduledOn(habit.schedule, dateKey)
}

/** Accumulated value for a habit on a day, from its entries. */
export function habitActualValue(habit: Habit, entries: HabitEntry[]): number {
  const relevant = entries.filter(
    (entry) => entry.habitId === habit.id && entry.type === habit.trackingType
  )
  switch (habit.trackingType) {
    case 'boolean':
      // Any boolean entry means completed; duplicates are prevented by a
      // unique index — defensively take the max rather than the sum.
      return relevant.some((entry) => entry.value >= 1) ? 1 : 0
    case 'quantity':
    case 'duration':
      return relevant.reduce((sum, entry) => sum + entry.value, 0)
  }
}

/**
 * Individual habit progress: 0..1. A habit can never contribute more than its
 * target (over-achievement is clamped to 1).
 */
export function habitProgress(habit: Habit, actual: number): number {
  // Target is validated > 0 at creation; guard defensively anyway.
  const target = habit.targetValue > 0 ? habit.targetValue : 1
  return Math.min(Math.max(actual, 0) / target, 1)
}

export function habitDayStatus(
  habit: Habit,
  actual: number,
  skipped: boolean
): HabitDayStatus {
  if (skipped) return 'skipped'
  if (habitProgress(habit, actual) >= 1) return 'completed'
  if (actual > 0) return 'in_progress'
  return 'pending'
}

/**
 * Overall day progress: mean of the included habits' progress × 100, rounded
 * to one decimal. Included = scheduled, active, and NOT skipped.
 */
export function computeDayProgress(
  included: Array<{ progress: number }>
): DayProgress {
  const includedCount = included.length
  if (includedCount === 0) {
    return { percent: null, includedCount: 0, completedCount: 0 }
  }
  const sum = included.reduce((total, habit) => total + habit.progress, 0)
  const completedCount = included.filter((habit) => habit.progress >= 1).length
  const percent = Math.round((sum / includedCount) * 1000) / 10
  return { percent, includedCount, completedCount }
}

/**
 * Suggested step for quick ± buttons on a quantity habit, so large targets
 * (e.g. 3 liters) don't need 3000 clicks.
 */
export function quantityStep(habit: Habit): number {
  if (habit.trackingType !== 'quantity') return 1
  if (habit.targetValue >= 30) {
    const step = habit.targetValue / 10
    return step % 1 === 0 ? step : Math.round(step * 10) / 10
  }
  return 1
}

/** Formats an actual/target pair for display, e.g. "35 / 50 push-ups". */
export function formatTargetProgress(habit: Habit, actual: number): string {
  if (habit.trackingType === 'boolean') {
    return actual >= 1 ? 'Completed' : 'Not completed'
  }
  const displayActual = trimNumber(actual)
  const displayTarget = trimNumber(habit.targetValue)
  const unit = habit.unit.trim()
  return `${displayActual} / ${displayTarget}${unit !== '' ? ` ${unit}` : ''}`
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}
