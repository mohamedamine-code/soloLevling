import type { z } from 'zod'
import type {
  ActiveTimerSession,
  DaySnapshot,
  DaySummaryPoint,
  HabitEntry,
  HabitTrackingState,
  HabitRangeStats,
  RangeAnalytics
} from '@shared/types'
import {
  computeDayProgress,
  habitActualValue,
  habitDayStatus,
  habitProgress,
  isHabitCountedOn
} from '@shared/domain/progress'
import { computeHabitStreaks, computeOverallStreaks } from '@shared/domain/streaks'
import { addDaysToKey, toLocalDateKey } from '@shared/utils/date'
import {
  dateKeySchema,
  durationMinutesSchema,
  habitIdSchema,
  quantityDeltaSchema,
  trackingValueSchema
} from '@shared/validation/tracking'
import type { HabitRepository } from '../db/repositories/habit-repository'
import type { TrackingRepository } from '../db/repositories/tracking-repository'
import { ServiceError } from './habit-service'

/**
 * Tracking business logic: day snapshots, entries, skip overrides, and timers.
 * Returns a fresh DaySnapshot after every mutation so the renderer (and later
 * the widget) always renders from the same source of truth.
 */

const SECONDS_PER_MINUTE = 60

export class TrackingService {
  constructor(
    private readonly habits: HabitRepository,
    private readonly tracking: TrackingRepository
  ) {}

  // ---- Snapshot ----

  getDaySnapshot(rawDate: string): DaySnapshot {
    const date = parseOrThrow(dateKeySchema, rawDate)
    return this.buildSnapshot(date)
  }

  private buildSnapshot(date: string): DaySnapshot {
    const habits = this.habits.listAll().filter((habit) => habit.archivedAt === null)
    const entries = this.tracking.listEntriesForDate(date)
    const overrides = this.tracking.listOverridesForDate(date)
    const skippedIds = new Set(
      overrides.filter((override) => override.status === 'skipped').map((override) => override.habitId)
    )

    const states: HabitTrackingState[] = []
    const included: Array<{ progress: number }> = []

    for (const habit of habits) {
      if (!isHabitCountedOn(habit, date)) continue
      const skipped = skippedIds.has(habit.id)
      const actual = habitActualValue(habit, entries)
      const progress = habitProgress(habit, actual)
      states.push({
        habit,
        status: habitDayStatus(habit, actual, skipped),
        actual,
        progress,
        skipped
      })
      if (!skipped) {
        included.push({ progress })
      }
    }

    return {
      date,
      states,
      progress: computeDayProgress(included),
      overallStreak: this.computeStreaks(date),
      activeTimer: this.activeTimerSession()
    }
  }

  /**
   * Overall daily streaks: a day counts when every scheduled, non-skipped
   * habit was completed. Days with nothing due neither count nor break.
   */
  private computeStreaks(todayKey: string): { current: number; best: number } {
    const habits = this.habits
      .listAll()
      .filter((habit) => habit.archivedAt === null)

    const starts = habits.map((habit) => habit.schedule.startDate)
    const earliest = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : todayKey
    if (earliest > todayKey) {
      return { current: 0, best: 0 }
    }

    const entries = this.tracking.listEntriesBetween(earliest, todayKey)
    const overrides = this.tracking.listOverridesBetween(earliest, todayKey)
    const skippedByDate = new Set(
      overrides
        .filter((override) => override.status === 'skipped')
        .map((override) => `${override.date}|${override.habitId}`)
    )
    const entriesByDate = new Map<string, HabitEntry[]>()
    for (const entry of entries) {
      const list = entriesByDate.get(entry.date) ?? []
      list.push(entry)
      entriesByDate.set(entry.date, list)
    }

    const summaries: Array<{ date: string; scheduledCount: number; completedCount: number }> = []
    let day = earliest
    while (day <= todayKey) {
      let scheduledCount = 0
      let completedCount = 0
      for (const habit of habits) {
        if (!isHabitCountedOn(habit, day)) continue
        const skipped = skippedByDate.has(`${day}|${habit.id}`)
        if (skipped) continue
        scheduledCount += 1
        const actual = habitActualValue(habit, entriesByDate.get(day) ?? [])
        if (habitProgress(habit, actual) >= 1) completedCount += 1
      }
      summaries.push({ date: day, scheduledCount, completedCount })
      day = nextKey(day)
    }

    return computeOverallStreaks(summaries, todayKey, earliest)
  }

  private activeTimerSession(): ActiveTimerSession | null {
    const record = this.tracking.getActiveSession()
    return record ? toActiveSession(record) : null
  }

  // ---- Range analytics ----

  /**
   * Aggregates a date range for the Analytics and History pages: per-day
   * completion points and per-habit performance with lifetime streaks.
   * Future days beyond today yield no data (never fake chart filler).
   */
  getRangeAnalytics(rawFrom: string, rawTo: string): RangeAnalytics {
    const from = parseOrThrow(dateKeySchema, rawFrom)
    const to = parseOrThrow(dateKeySchema, rawTo)
    if (from > to) {
      throw new ServiceError('Range start must be on or before the end date')
    }

    const todayKey = toLocalDateKey(new Date())
    const end = to <= todayKey ? to : todayKey

    const habits = this.habits.listAll().filter((habit) => habit.archivedAt === null)

    if (from > end) {
      return {
        fromDate: from,
        toDate: to,
        days: [],
        habits: habits.map((habit) => emptyHabitStats(habit)),
        totalDurationMinutes: 0,
        averagePercent: null
      }
    }

    // Full-history fetch for accurate lifetime streaks (schedule start bound).
    const starts = habits.map((habit) => habit.schedule.startDate)
    const earliest = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : from
    const fetchFrom = earliest < from ? earliest : from

    const entries = this.tracking.listEntriesBetween(fetchFrom, todayKey)
    const overrides = this.tracking.listOverridesBetween(fetchFrom, todayKey)
    const skippedByDate = new Set(
      overrides
        .filter((override) => override.status === 'skipped')
        .map((override) => `${override.date}|${override.habitId}`)
    )
    const entriesByDate = new Map<string, HabitEntry[]>()
    for (const entry of entries) {
      const list = entriesByDate.get(entry.date) ?? []
      list.push(entry)
      entriesByDate.set(entry.date, list)
    }

    // Per-habit completion/skip sets across the whole fetched window.
    const completedByHabit = new Map<string, Set<string>>()
    const skippedByHabit = new Map<string, Set<string>>()

    let day = fetchFrom
    while (day <= todayKey) {
      for (const habit of habits) {
        if (!isHabitCountedOn(habit, day)) continue
        if (skippedByDate.has(`${day}|${habit.id}`)) {
          addToSet(skippedByHabit, habit.id, day)
          continue
        }
        const actual = habitActualValue(habit, entriesByDate.get(day) ?? [])
        if (habitProgress(habit, actual) >= 1) {
          addToSet(completedByHabit, habit.id, day)
        }
      }
      day = nextKey(day)
    }

    // Range aggregates.
    const days: DaySummaryPoint[] = []
    const totals = new Map<string, { scheduled: number; completed: number; value: number }>()
    let durationSum = 0
    let percentSum = 0
    let percentDays = 0

    day = from
    while (day <= end) {
      let skippedCount = 0
      let missedCount = 0
      for (const habit of habits) {
        if (!isHabitCountedOn(habit, day)) continue
        const skipped = skippedByDate.has(`${day}|${habit.id}`)
        const actual = habitActualValue(habit, entriesByDate.get(day) ?? [])
        const progress = habitProgress(habit, actual)

        if (skipped) {
          skippedCount += 1
          continue
        }
        const bucket = totals.get(habit.id) ?? { scheduled: 0, completed: 0, value: 0 }
        bucket.scheduled += 1
        if (habit.trackingType === 'duration' || habit.trackingType === 'quantity') {
          bucket.value += actual
        }
        if (progress >= 1) {
          bucket.completed += 1
          if (habit.trackingType === 'boolean') bucket.value += 1
        }
        totals.set(habit.id, bucket)
        if (progress < 1) missedCount += 1
      }

      const dayProgress = computeDayProgress(
        habits
          .filter((habit) => isHabitCountedOn(habit, day) && !skippedByDate.has(`${day}|${habit.id}`))
          .map((habit) => ({
            progress: habitProgress(habit, habitActualValue(habit, entriesByDate.get(day) ?? []))
          }))
      )
      if (dayProgress.percent !== null) {
        percentSum += dayProgress.percent
        percentDays += 1
      }
      days.push({ date: day, ...dayProgress, skippedCount, missedCount })

      if (day === end) break
      day = nextKey(day)
    }

    for (const entry of entries) {
      if (entry.type === 'duration' && entry.date >= from && entry.date <= end) {
        durationSum += entry.value
      }
    }

    const habitStats: HabitRangeStats[] = habits.map((habit) => {
      const bucket = totals.get(habit.id) ?? { scheduled: 0, completed: 0, value: 0 }
      const streaks = computeHabitStreaks({
        schedule: habit.schedule,
        skippedDates: [...(skippedByHabit.get(habit.id) ?? [])],
        completedDates: [...(completedByHabit.get(habit.id) ?? [])],
        todayKey
      })
      return {
        habitId: habit.id,
        name: habit.name,
        trackingType: habit.trackingType,
        unit: habit.unit,
        color: habit.color,
        icon: habit.icon,
        scheduledDays: bucket.scheduled,
        completedDays: bucket.completed,
        currentStreak: streaks.current,
        bestStreak: streaks.best,
        totalValue: habit.trackingType === 'boolean' ? bucket.completed : bucket.value
      }
    })

    return {
      fromDate: from,
      toDate: to,
      days,
      habits: habitStats,
      totalDurationMinutes: Math.round(durationSum * 10) / 10,
      averagePercent: percentDays === 0 ? null : Math.round((percentSum / percentDays) * 10) / 10
    }
  }

  // ---- Boolean ----

  complete(rawHabitId: string, rawDate: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    this.requireActiveHabit(habitId)

    const existing = this.tracking
      .listEntriesForDate(date)
      .some((entry) => entry.habitId === habitId && entry.type === 'boolean')
    if (!existing) {
      this.tracking.insertEntry(habitId, date, 'boolean', 1)
    }
    return this.buildSnapshot(date)
  }

  uncomplete(rawHabitId: string, rawDate: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    this.requireActiveHabit(habitId)

    this.tracking.deleteBooleanEntries(habitId, date)
    return this.buildSnapshot(date)
  }

  // ---- Quantity ----

  setQuantity(rawHabitId: string, rawDate: string, rawValue: number): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    const value = parseOrThrow(trackingValueSchema, rawValue)
    this.requireActiveHabit(habitId)

    this.tracking.deleteQuantityEntries(habitId, date)
    if (value > 0) {
      this.tracking.insertEntry(habitId, date, 'quantity', value)
    }
    return this.buildSnapshot(date)
  }

  incrementQuantity(rawHabitId: string, rawDate: string, rawDelta: number): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    const delta = parseOrThrow(quantityDeltaSchema, rawDelta)
    const habit = this.requireActiveHabit(habitId)
    if (habit.trackingType !== 'quantity') {
      throw new ServiceError('This habit is not quantity-tracked')
    }

    const actual = habitActualValue(
      habit,
      this.tracking.listEntriesForDate(date)
    )
    const next = Math.max(0, round(actual + delta))
    return this.setQuantity(habitId, date, next)
  }

  // ---- Duration ----

  addDuration(rawHabitId: string, rawDate: string, rawMinutes: number): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    const minutes = parseOrThrow(durationMinutesSchema, rawMinutes)
    const habit = this.requireActiveHabit(habitId)
    if (habit.trackingType !== 'duration') {
      throw new ServiceError('This habit is not duration-tracked')
    }

    this.tracking.insertEntry(habitId, date, 'duration', minutes)
    return this.buildSnapshot(date)
  }

  startTimer(rawHabitId: string, rawDate: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    const habit = this.requireActiveHabit(habitId)
    if (habit.trackingType !== 'duration') {
      throw new ServiceError('Timers are only available for duration habits')
    }

    const active = this.tracking.getActiveSession()
    if (active) {
      throw new ServiceError(
        active.habitId === habitId
          ? 'The timer is already running for this habit'
          : 'Finish the active timer first — only one timer can run at a time'
      )
    }

    this.tracking.insertSession(habitId, date, new Date().toISOString())
    return this.buildSnapshot(date)
  }

  pauseTimer(rawHabitId: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    this.requireActiveHabit(habitId)
    const session = this.tracking.getSessionForHabit(habitId)
    if (!session || session.status !== 'running') {
      throw new ServiceError('No running timer for this habit')
    }

    const elapsed = sessionElapsedSeconds(session)
    this.tracking.updateSession({
      ...session,
      accumulatedSeconds: elapsed,
      startedAt: null,
      status: 'paused'
    })
    return this.buildSnapshot(session.date)
  }

  resumeTimer(rawHabitId: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    this.requireActiveHabit(habitId)
    const session = this.tracking.getSessionForHabit(habitId)
    if (!session || session.status !== 'paused') {
      throw new ServiceError('No paused timer for this habit')
    }

    this.tracking.updateSession({ ...session, startedAt: new Date().toISOString(), status: 'running' })
    return this.buildSnapshot(session.date)
  }

  stopTimer(rawHabitId: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    this.requireActiveHabit(habitId)
    const session = this.tracking.getSessionForHabit(habitId)
    if (!session) {
      throw new ServiceError('No active timer for this habit')
    }

    const elapsedSeconds = sessionElapsedSeconds(session)
    this.tracking.deleteSession(session.id)

    const minutes = round((elapsedSeconds / SECONDS_PER_MINUTE) * 10) / 10
    if (minutes > 0) {
      this.tracking.insertEntry(habitId, session.date, 'duration', minutes)
    }
    return this.buildSnapshot(session.date)
  }

  // ---- Skip ----

  skip(rawHabitId: string, rawDate: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    this.requireActiveHabit(habitId)

    this.tracking.upsertOverride(habitId, date, 'skipped')
    return this.buildSnapshot(date)
  }

  unskip(rawHabitId: string, rawDate: string): DaySnapshot {
    const habitId = parseOrThrow(habitIdSchema, rawHabitId)
    const date = parseOrThrow(dateKeySchema, rawDate)
    this.requireActiveHabit(habitId)

    this.tracking.deleteOverride(habitId, date)
    return this.buildSnapshot(date)
  }

  // ---- Helpers ----

  getActiveTimerSession(): ActiveTimerSession | null {
    const record = this.tracking.getActiveSession()
    return record ? toActiveSession(record) : null
  }

  private requireActiveHabit(habitId: string) {
    const habit = this.habits.getById(habitId)
    if (!habit) {
      throw new ServiceError('Habit not found')
    }
    if (habit.archivedAt !== null) {
      throw new ServiceError('Archived habits cannot be tracked')
    }
    return habit
  }
}

interface SessionLike {
  startedAt: string | null
  accumulatedSeconds: number
  status: 'running' | 'paused'
}

function sessionElapsedSeconds(session: SessionLike): number {
  if (session.status !== 'running' || session.startedAt === null) {
    return session.accumulatedSeconds
  }
  const elapsed = (Date.now() - new Date(session.startedAt).getTime()) / 1000
  return Math.max(0, session.accumulatedSeconds + elapsed)
}

function toActiveSession(record: {
  id: string
  habitId: string
  date: string
  startedAt: string | null
  accumulatedSeconds: number
  status: 'running' | 'paused'
}): ActiveTimerSession {
  return {
    id: record.id,
    habitId: record.habitId,
    date: record.date,
    status: record.status,
    startedAt: record.startedAt,
    elapsedSeconds: Math.floor(sessionElapsedSeconds(record))
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function addToSet(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key)
  if (set) {
    set.add(value)
  } else {
    map.set(key, new Set([value]))
  }
}

function emptyHabitStats(habit: {
  id: string
  name: string
  trackingType: HabitRangeStats['trackingType']
  unit: string
  color: string
  icon: string
}): HabitRangeStats {
  return {
    habitId: habit.id,
    name: habit.name,
    trackingType: habit.trackingType,
    unit: habit.unit,
    color: habit.color,
    icon: habit.icon,
    scheduledDays: 0,
    completedDays: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalValue: 0
  }
}

function nextKey(key: string): string {
  return addDaysToKey(key, 1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: any): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ServiceError(result.error.issues[0]?.message ?? 'Invalid input')
  }
  return result.data
}
