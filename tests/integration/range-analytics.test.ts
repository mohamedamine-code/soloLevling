import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseInstance } from '../../electron/main/db/connection'
import { runMigrations } from '../../electron/main/db/migrate'
import { MIGRATIONS } from '../../electron/main/db/migrations'
import { HabitRepository } from '../../electron/main/db/repositories/habit-repository'
import { TrackingRepository } from '../../electron/main/db/repositories/tracking-repository'
import { HabitService } from '../../electron/main/services/habit-service'
import { TrackingService } from '../../electron/main/services/tracking-service'
import { toLocalDateKey } from '@shared/utils/date'

let db: DatabaseInstance
let tempDir: string
let habits: HabitRepository
let tracking: TrackingRepository
let habitService: HabitService
let service: TrackingService
let today: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'sololeving-range-'))
  db = openDatabase(tempDir)
  runMigrations(db, MIGRATIONS)
  habits = new HabitRepository(db)
  tracking = new TrackingRepository(db)
  habitService = new HabitService(habits)
  service = new TrackingService(habits, tracking)
  today = toLocalDateKey()
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('getRangeAnalytics', () => {
  it('aggregates per-day completion and totals over the range', () => {
    const boolean = habitService.create({ name: 'Pray', category: 'spiritual', trackingType: 'boolean' })
    const quantity = habitService.create({
      name: 'Push-ups',
      category: 'health',
      trackingType: 'quantity',
      targetValue: 50,
      unit: 'reps'
    })

    service.complete(boolean.id, today)
    service.setQuantity(quantity.id, today, 50)

    const result = service.getRangeAnalytics(today, today)
    expect(result.days).toHaveLength(1)
    const day = result.days[0]
    expect(day?.date).toBe(today)
    expect(day?.percent).toBe(100)
    expect(day?.completedCount).toBe(2)
    expect(day?.missedCount).toBe(0)
    expect(day?.skippedCount).toBe(0)
    expect(result.averagePercent).toBe(100)
  })

  it('counts skips as skipped, not missed, and keeps them out of the denominator', () => {
    const boolean = habitService.create({ name: 'Pray', category: 'spiritual', trackingType: 'boolean' })
    const quantity = habitService.create({
      name: 'Push-ups',
      category: 'health',
      trackingType: 'quantity',
      targetValue: 50
    })

    service.skip(quantity.id, today)
    // Boolean not completed → the only counted habit is missed.
    const result = service.getRangeAnalytics(today, today)
    const day = result.days[0]
    expect(day?.includedCount).toBe(1)
    expect(day?.skippedCount).toBe(1)
    expect(day?.missedCount).toBe(1)
    expect(day?.percent).toBe(0)
    expect(result.habits.find((habit) => habit.habitId === boolean.id)?.completedDays).toBe(0)
  })

  it('computes per-habit completion rate, lifetime streaks, and totals', () => {
    const quantity = habitService.create({
      name: 'Push-ups',
      category: 'health',
      trackingType: 'quantity',
      targetValue: 50
    })
    const duration = habitService.create({
      name: 'Study',
      category: 'learning',
      trackingType: 'duration',
      targetValue: 60,
      unit: 'minutes'
    })

    service.setQuantity(quantity.id, today, 50)
    service.addDuration(duration.id, today, 45)

    const result = service.getRangeAnalytics(today, today)
    const stats = result.habits.find((habit) => habit.habitId === quantity.id)
    expect(stats?.scheduledDays).toBe(1)
    expect(stats?.completedDays).toBe(1)
    expect(stats?.currentStreak).toBe(1)
    expect(stats?.bestStreak).toBe(1)
    expect(stats?.totalValue).toBe(50)

    const study = result.habits.find((habit) => habit.habitId === duration.id)
    expect(study?.completedDays).toBe(0) // 45 of 60 minutes
    expect(study?.totalValue).toBe(45)
    expect(result.totalDurationMinutes).toBe(45)
  })

  it('never counts future days as misses (honest charts)', () => {
    const boolean = habitService.create({ name: 'Pray', category: 'spiritual', trackingType: 'boolean' })
    service.complete(boolean.id, today)

    // Range extends into the future — future days must not appear at all.
    const future = service.getRangeAnalytics(today, '2099-12-31')
    expect(future.days).toHaveLength(1)
    expect(future.days[0]?.date).toBe(today)
    expect(future.toDate).toBe('2099-12-31')
  })

  it('returns no days for a range entirely in the future', () => {
    const result = service.getRangeAnalytics('2099-01-01', '2099-01-07')
    expect(result.days).toHaveLength(0)
    expect(result.averagePercent).toBeNull()
    expect(result.habits.every((habit) => habit.scheduledDays === 0)).toBe(true)
  })

  it('rejects inverted ranges', () => {
    expect(() => service.getRangeAnalytics(today, '2020-01-01')).toThrow(/before/i)
  })
})
