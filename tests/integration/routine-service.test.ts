import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DatabaseInstance } from '../../electron/main/db/connection'
import { runMigrations } from '../../electron/main/db/migrate'
import { MIGRATIONS } from '../../electron/main/db/migrations'
import { HabitRepository } from '../../electron/main/db/repositories/habit-repository'
import { RoutineRepository } from '../../electron/main/db/repositories/routine-repository'
import { HabitService } from '../../electron/main/services/habit-service'
import { RoutineService } from '../../electron/main/services/routine-service'

let db: DatabaseInstance
let tempDir: string
let habits: HabitRepository
let routineRepo: RoutineRepository
let habitService: HabitService
let service: RoutineService

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'sololeving-routines-'))
  db = openDatabase(tempDir)
  runMigrations(db, MIGRATIONS)
  habits = new HabitRepository(db)
  routineRepo = new RoutineRepository(db, habits)
  habitService = new HabitService(habits)
  service = new RoutineService(habits, routineRepo)
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('routine CRUD', () => {
  it('creates a routine with ordered members', () => {
    const a = habitService.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    const b = habitService.create({ name: 'B', category: 'health', trackingType: 'boolean' })

    const routine = service.create({ name: 'Morning', description: 'Start the day', habitIds: [b.id, a.id] })
    expect(routine.name).toBe('Morning')
    expect(routine.habits.map((habit) => habit.id)).toEqual([b.id, a.id])
  })

  it('lists routines with resolved habit data in order', () => {
    const a = habitService.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    const b = habitService.create({ name: 'B', category: 'health', trackingType: 'boolean' })
    service.create({ name: 'Morning', habitIds: [a.id, b.id] })
    service.create({ name: 'Evening', habitIds: [b.id] })

    const list = service.list()
    expect(list).toHaveLength(2)
    const morning = list.find((routine) => routine.name === 'Morning')
    expect(morning?.habits[0]?.name).toBe('A')
    expect(morning?.habits[1]?.category).toBe('health')
  })

  it('update replaces fields and can replace the member list', () => {
    const a = habitService.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    const b = habitService.create({ name: 'B', category: 'health', trackingType: 'boolean' })
    const routine = service.create({ name: 'Morning', habitIds: [a.id] })

    const renamed = service.update(routine.id, { name: 'Reset', description: 'New' })
    expect(renamed.name).toBe('Reset')
    expect(renamed.description).toBe('New')
    expect(renamed.habits).toHaveLength(1)

    const swapped = service.update(routine.id, { habitIds: [b.id] })
    expect(swapped.habits.map((habit) => habit.id)).toEqual([b.id])
  })

  it('update with undefined fields preserves everything (partial update)', () => {
    const a = habitService.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    const routine = service.create({ name: 'Morning', description: 'Keep me', habitIds: [a.id] })
    const untouched = service.update(routine.id, {})
    expect(untouched.name).toBe('Morning')
    expect(untouched.description).toBe('Keep me')
    expect(untouched.habits.map((habit) => habit.id)).toEqual([a.id])
  })

  it('deletes a routine without touching member habits', () => {
    const a = habitService.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    const routine = service.create({ name: 'Morning', habitIds: [a.id] })
    service.delete(routine.id)
    expect(service.list()).toHaveLength(0)
    expect(habitService.list()).toHaveLength(1)
  })

  it('rejects unknown ids, empty names, and missing members', () => {
    expect(() => service.delete(randomUUID())).toThrow(/not found/i)
    expect(() => service.update(randomUUID(), { name: 'X' })).toThrow(/not found/i)

    expect(() => service.create({ name: '', habitIds: [] })).toThrow(/required/i)

    const a = habitService.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    expect(() => service.create({ name: 'Morning', habitIds: [randomUUID()] })).toThrow(/no longer exists/i)
    expect(() => service.create({ name: 'Morning', habitIds: [a.id, a.id] })).toThrow(/duplicate/i)
  })

  it('rejects archived habits as members', () => {
    const a = habitService.create({ name: 'A', category: 'personal', trackingType: 'boolean' })
    habitService.archive(a.id)
    expect(() => service.create({ name: 'Morning', habitIds: [a.id] })).toThrow(/archived/i)
  })
})
