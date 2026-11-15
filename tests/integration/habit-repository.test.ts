import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseInstance } from '../../electron/main/db/connection'
import { runMigrations } from '../../electron/main/db/migrate'
import { MIGRATIONS } from '../../electron/main/db/migrations'
import { HabitRepository } from '../../electron/main/db/repositories/habit-repository'
import { SettingsRepository } from '../../electron/main/db/repositories/settings-repository'
import { HabitService, ServiceError } from '../../electron/main/services/habit-service'
import { toLocalDateKey } from '@shared/utils/date'

let db: DatabaseInstance
let tempDir: string
let repository: HabitRepository
let service: HabitService
let settings: SettingsRepository

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'sololeving-test-'))
  db = openDatabase(tempDir)
  runMigrations(db, MIGRATIONS)
  repository = new HabitRepository(db)
  service = new HabitService(repository)
  settings = new SettingsRepository(db)
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('migrations', () => {
  it('applies all migrations and records them', () => {
    const versions = (
      db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
        version: number
      }>
    ).map((row) => row.version)
    expect(versions).toEqual(MIGRATIONS.map((migration) => migration.version))
  })

  it('is idempotent when run twice', () => {
    expect(() => runMigrations(db, MIGRATIONS)).not.toThrow()
  })
})

describe('habit creation', () => {
  it('creates a daily boolean habit with defaults', () => {
    const habit = service.create({
      name: '  Read Quran  ',
      category: 'spiritual',
      trackingType: 'boolean'
    })

    expect(habit.name).toBe('Read Quran')
    expect(habit.targetValue).toBe(1)
    expect(habit.unit).toBe('')
    expect(habit.isActive).toBe(true)
    expect(habit.archivedAt).toBeNull()
    expect(habit.schedule.type).toBe('daily')
    expect(habit.schedule.startDate).toBe(toLocalDateKey())
    expect(habit.schedule.endDate).toBeNull()
    expect(habit.icon).toBe('Sparkles')
    expect(repository.getById(habit.id)).toMatchObject({ id: habit.id })
  })

  it('creates a quantity habit with a target and unit', () => {
    const habit = service.create({
      name: 'Push-ups',
      category: 'health',
      trackingType: 'quantity',
      targetValue: 50,
      unit: 'reps'
    })
    expect(habit.targetValue).toBe(50)
    expect(habit.unit).toBe('reps')
  })

  it('rejects quantity habits without a positive target', () => {
    expect(() =>
      service.create({
        name: 'Push-ups',
        category: 'health',
        trackingType: 'quantity'
      })
    ).toThrow(ServiceError)
  })

  it('rejects invalid categories', () => {
    expect(() =>
      service.create({
        name: 'Bad',
        category: 'chaos' as 'personal',
        trackingType: 'boolean'
      })
    ).toThrow(ServiceError)
  })

  it('rejects weekday schedules without any selected weekday', () => {
    expect(() =>
      service.create({
        name: 'Gym',
        category: 'health',
        trackingType: 'boolean',
        schedule: { type: 'weekdays', weekdays: [] }
      })
    ).toThrow(/weekday/i)
  })

  it('rejects end dates before start dates', () => {
    expect(() =>
      service.create({
        name: 'Gym',
        category: 'health',
        trackingType: 'boolean',
        schedule: {
          type: 'daily',
          startDate: '2026-05-10',
          endDate: '2026-05-01'
        }
      })
    ).toThrow(/end date/i)
  })
})

describe('habit updates', () => {
  it('renames and changes the target', () => {
    const habit = service.create({
      name: 'Read',
      category: 'learning',
      trackingType: 'quantity',
      targetValue: 20,
      unit: 'pages'
    })
    const updated = service.update(habit.id, { name: 'Read books', targetValue: 30 })
    expect(updated.name).toBe('Read books')
    expect(updated.targetValue).toBe(30)
    // Untouched fields persist.
    expect(updated.schedule.type).toBe('daily')
    expect(updated.unit).toBe('pages')
  })

  it('preserves weekdays when updating an unrelated field', () => {
    const habit = service.create({
      name: 'Gym',
      category: 'health',
      trackingType: 'boolean',
      schedule: { type: 'weekdays', weekdays: [1, 3, 5], startDate: '2026-01-05' }
    })
    const updated = service.update(habit.id, { description: 'Heavy day' })
    expect(updated.schedule.type).toBe('weekdays')
    expect(updated.schedule.weekdays).toEqual([1, 3, 5])
  })

  it('forces boolean habits back to target 1', () => {
    const habit = service.create({
      name: 'Read',
      category: 'learning',
      trackingType: 'quantity',
      targetValue: 20
    })
    const updated = service.update(habit.id, { trackingType: 'boolean', targetValue: 99 })
    expect(updated.trackingType).toBe('boolean')
    expect(updated.targetValue).toBe(1)
    expect(updated.unit).toBe('')
  })

  it('rejects unknown ids', () => {
    expect(() =>
      service.update('00000000-0000-0000-0000-000000000000', { name: 'Ghost' })
    ).toThrow(/not found/i)
  })
})

describe('archive / restore / delete', () => {
  it('archives and restores', () => {
    const habit = service.create({ name: 'Walk', category: 'health', trackingType: 'boolean' })
    const archived = service.archive(habit.id)
    expect(archived.archivedAt).not.toBeNull()
    expect(archived.isActive).toBe(false)

    const restored = service.restore(habit.id)
    expect(restored.archivedAt).toBeNull()
    expect(restored.isActive).toBe(true)
  })

  it('deletes along with its schedule', () => {
    const habit = service.create({ name: 'Walk', category: 'health', trackingType: 'boolean' })
    service.remove(habit.id)
    expect(repository.getById(habit.id)).toBeNull()
    const scheduleRows = db
      .prepare('SELECT COUNT(*) AS n FROM habit_schedules WHERE habit_id = ?')
      .get(habit.id) as { n: number }
    expect(scheduleRows.n).toBe(0)
  })
})

describe('ordering', () => {
  it('assigns ascending sort orders and honors reorder', () => {
    const a = service.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    const b = service.create({ name: 'B', category: 'personal', trackingType: 'boolean' })
    const c = service.create({ name: 'C', category: 'personal', trackingType: 'boolean' })

    const reordered = service.reorder([c.id, a.id, b.id])
    expect(reordered.map((habit) => habit.id)).toEqual([c.id, a.id, b.id])
    expect(reordered.map((habit) => habit.sortOrder)).toEqual([0, 1, 2])
  })
})

describe('settings', () => {
  it('stores and updates values', () => {
    expect(settings.get('missing')).toBeNull()
    settings.set('widget.visible', 'true')
    settings.set('widget.visible', 'false')
    expect(settings.get('widget.visible')).toBe('false')
  })
})
