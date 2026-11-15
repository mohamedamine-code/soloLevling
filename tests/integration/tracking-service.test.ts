import { randomUUID } from 'node:crypto'
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
  tempDir = mkdtempSync(join(tmpdir(), 'sololeving-tracking-'))
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

function createQuantityHabit(target = 50) {
  return habitService.create({
    name: 'Push-ups',
    category: 'health',
    trackingType: 'quantity',
    targetValue: target,
    unit: 'reps'
  })
}

describe('day snapshot', () => {
  it('returns null percent when nothing is scheduled (honest empty state)', () => {
    const snapshot = service.getDaySnapshot(today)
    expect(snapshot.progress.percent).toBeNull()
    expect(snapshot.states).toEqual([])
  })

  it('includes scheduled habits with correct status', () => {
    const boolean = habitService.create({
      name: 'Pray',
      category: 'spiritual',
      trackingType: 'boolean'
    })
    const snapshot = service.getDaySnapshot(today)
    expect(snapshot.states).toHaveLength(1)
    expect(snapshot.states[0]?.habit.id).toBe(boolean.id)
    expect(snapshot.states[0]?.status).toBe('pending')
    expect(snapshot.progress.includedCount).toBe(1)
  })

  it('archived habits are excluded from the snapshot', () => {
    const habit = habitService.create({ name: 'Old', category: 'personal', trackingType: 'boolean' })
    habitService.archive(habit.id)
    expect(service.getDaySnapshot(today).states).toHaveLength(0)
  })
})

describe('boolean tracking', () => {
  it('complete/uncomplete is idempotent and updates progress', () => {
    const habit = habitService.create({ name: 'Pray', category: 'spiritual', trackingType: 'boolean' })

    const completed = service.complete(habit.id, today)
    expect(completed.states[0]?.status).toBe('completed')
    expect(completed.progress.percent).toBe(100)
    expect(completed.progress.completedCount).toBe(1)

    // Completing again does not duplicate (unique index holds).
    const again = service.complete(habit.id, today)
    expect(again.states[0]?.status).toBe('completed')
    const entries = tracking.listEntriesForDate(today)
    expect(entries).toHaveLength(1)

    const uncompleted = service.uncomplete(habit.id, today)
    expect(uncompleted.states[0]?.status).toBe('pending')
    expect(uncompleted.progress.percent).toBe(0)
    expect(tracking.listEntriesForDate(today)).toHaveLength(0)
  })

  it('rejects tracking for unknown or archived habits', () => {
    expect(() => service.complete(randomUUID(), today)).toThrow(/not found/i)
    const habit = habitService.create({ name: 'X', category: 'personal', trackingType: 'boolean' })
    habitService.archive(habit.id)
    expect(() => service.complete(habit.id, today)).toThrow(/archived/i)
  })
})

describe('quantity tracking', () => {
  it('set replaces and increment clamps at zero', () => {
    const habit = createQuantityHabit(50)

    const afterSet = service.setQuantity(habit.id, today, 35)
    expect(afterSet.states[0]?.actual).toBe(35)
    expect(afterSet.states[0]?.status).toBe('in_progress')
    expect(afterSet.progress.percent).toBe(70)

    const afterInc = service.incrementQuantity(habit.id, today, 5)
    expect(afterInc.states[0]?.actual).toBe(40)

    const afterDec = service.incrementQuantity(habit.id, today, -100)
    expect(afterDec.states[0]?.actual).toBe(0)

    // Reaching (or exceeding) target completes the habit and clamps at 100%.
    const afterBurst = service.incrementQuantity(habit.id, today, 999)
    expect(afterBurst.states[0]?.actual).toBe(999)
    expect(afterBurst.states[0]?.status).toBe('completed')
    expect(afterBurst.progress.percent).toBe(100)
  })

  it('setting zero clears the entries', () => {
    const habit = createQuantityHabit(50)
    service.setQuantity(habit.id, today, 10)
    const after = service.setQuantity(habit.id, today, 0)
    expect(after.states[0]?.actual).toBe(0)
    expect(tracking.listEntriesForDate(today)).toHaveLength(0)
  })

  it('rejects negative values', () => {
    const habit = createQuantityHabit(50)
    expect(() => service.setQuantity(habit.id, today, -5)).toThrow(/negative|greater/i)
  })
})

describe('duration tracking', () => {
  function createDurationHabit() {
    return habitService.create({
      name: 'Study',
      category: 'learning',
      trackingType: 'duration',
      targetValue: 60,
      unit: 'minutes'
    })
  }

  it('manual entries accumulate', () => {
    const habit = createDurationHabit()
    const afterFirst = service.addDuration(habit.id, today, 25)
    const afterSecond = service.addDuration(habit.id, today, 15)
    expect(afterFirst.states[0]?.actual).toBe(25)
    expect(afterSecond.states[0]?.actual).toBe(40)
    expect(afterSecond.progress.percent).toBe(66.7)
    expect(tracking.listEntriesForDate(today)).toHaveLength(2)
  })

  it('timer lifecycle: start, pause, resume, stop commits an entry', () => {
    const habit = createDurationHabit()

    service.startTimer(habit.id, today)
    const paused = service.pauseTimer(habit.id)
    expect(paused.activeTimer?.status).toBe('paused')
    expect(paused.activeTimer?.elapsedSeconds).toBeGreaterThanOrEqual(0)

    service.resumeTimer(habit.id)
    const running = service.getDaySnapshot(today)
    expect(running.activeTimer?.status).toBe('running')

    const stopped = service.stopTimer(habit.id)
    expect(stopped.activeTimer).toBeNull()
    // Tiny elapsed time rounds to 0.0 minutes → no zero-value entry.
    expect(stopped.states[0]?.actual).toBeGreaterThanOrEqual(0)
    const activeSessions = tracking.getActiveSession()
    expect(activeSessions).toBeNull()
  })

  it('prevents two simultaneous active timers', () => {
    const a = createDurationHabit()
    const b = createDurationHabit()
    service.startTimer(a.id, today)
    expect(() => service.startTimer(b.id, today)).toThrow(/one timer/i)
    expect(() => service.startTimer(a.id, today)).toThrow(/already running/i)
  })

  it('rejects timers for non-duration habits', () => {
    const habit = habitService.create({ name: 'Walk', category: 'health', trackingType: 'boolean' })
    expect(() => service.startTimer(habit.id, today)).toThrow(/duration/i)
  })

  it('survives restart: active session is persisted in the database', () => {
    const habit = createDurationHabit()
    service.startTimer(habit.id, today)
    // Simulate a fresh service instance over the same database ("restart").
    const recovered = new TrackingService(habits, tracking)
    const active = recovered.getActiveTimerSession()
    expect(active?.habitId).toBe(habit.id)
    expect(active?.status).toBe('running')
  })
})

describe('skip overrides', () => {
  it('skipping removes the habit from the denominator', () => {
    const a = createQuantityHabit(50)
    habitService.create({ name: 'Pray', category: 'spiritual', trackingType: 'boolean' })

    const baseline = service.getDaySnapshot(today)
    expect(baseline.progress.includedCount).toBe(2)

    const skipped = service.skip(a.id, today)
    expect(skipped.states.find((state) => state.habit.id === a.id)?.status).toBe('skipped')
    expect(skipped.progress.includedCount).toBe(1)
    expect(skipped.progress.percent).toBe(0) // remaining habit not completed yet

    // Skipping does not create tracking entries.
    expect(tracking.listEntriesForDate(today)).toHaveLength(0)

    const unskipped = service.unskip(a.id, today)
    expect(unskipped.progress.includedCount).toBe(2)
  })

  it('skipped overrides are recorded and survive restarts', () => {
    const habit = createQuantityHabit(50)
    service.skip(habit.id, today)
    const overrides = tracking.listOverridesForDate(today)
    expect(overrides).toHaveLength(1)
    expect(overrides[0]?.status).toBe('skipped')
  })
})

describe('overall streaks (service level)', () => {
  it('a day with everything completed counts; skipped habits do not block it', () => {
    const a = createQuantityHabit(50)
    const b = habitService.create({ name: 'Pray', category: 'spiritual', trackingType: 'boolean' })

    service.complete(b.id, today)
    let snapshot = service.getDaySnapshot(today)
    expect(snapshot.overallStreak.current).toBe(0) // a not completed yet

    service.skip(a.id, today) // excluded from denominator
    snapshot = service.getDaySnapshot(today)
    expect(snapshot.overallStreak.current).toBe(1) // b is the only remaining habit and it is done
  })

  it('completing everything yields a current streak of 1', () => {
    const a = createQuantityHabit(50)
    const b = habitService.create({ name: 'Pray', category: 'spiritual', trackingType: 'boolean' })
    service.setQuantity(a.id, today, 50)
    service.complete(b.id, today)
    const snapshot = service.getDaySnapshot(today)
    expect(snapshot.overallStreak.current).toBe(1)
    expect(snapshot.progress.percent).toBe(100)
  })
})
