import { randomUUID } from 'node:crypto'
import type { DatabaseInstance } from '../connection'
import type { Habit, Routine } from '@shared/types'
import type { HabitRepository } from './habit-repository'

/**
 * All routine SQL lives here. Routines are stored as a header row plus an
 * ordered member list (routine_habits); members are resolved to full Habit
 * objects on read via the HabitRepository (single source of habit data).
 */

interface RoutineRow {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

interface MemberRow {
  routine_id: string
  habit_id: string
  position: number
}

export class RoutineRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly habits: HabitRepository
  ) {}

  private mapRoutine(row: RoutineRow, memberRows: MemberRow[]): Routine | null {
    const byId = new Map(this.habits.listAll().map((habit) => [habit.id, habit]))
    const members: Habit[] = []
    for (const member of memberRows) {
      const habit = byId.get(member.habit_id)
      if (habit) members.push(habit)
    }
    if (members.length === 0 && memberRows.length > 0) {
      // Every member vanished — do not return a hollow routine.
      return null
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      habits: members,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  list(): Routine[] {
    const routineRows = this.db
      .prepare('SELECT * FROM routines ORDER BY created_at ASC')
      .all() as RoutineRow[]
    const memberRows = this.db
      .prepare('SELECT routine_id, habit_id, position FROM routine_habits ORDER BY position ASC')
      .all() as MemberRow[]

    const membersByRoutine = new Map<string, MemberRow[]>()
    for (const member of memberRows) {
      const list = membersByRoutine.get(member.routine_id) ?? []
      list.push(member)
      membersByRoutine.set(member.routine_id, list)
    }

    const routines: Routine[] = []
    for (const row of routineRows) {
      const routine = this.mapRoutine(row, membersByRoutine.get(row.id) ?? [])
      if (routine) routines.push(routine)
    }
    return routines
  }

  getById(id: string): Routine | null {
    const row = this.db.prepare('SELECT * FROM routines WHERE id = ?').get(id) as
      | RoutineRow
      | undefined
    if (!row) return null
    const members = this.db
      .prepare('SELECT routine_id, habit_id, position FROM routine_habits WHERE routine_id = ? ORDER BY position ASC')
      .all(id) as MemberRow[]
    return this.mapRoutine(row, members)
  }

  create(name: string, description: string, habitIds: string[]): Routine {
    const now = new Date().toISOString()
    const id = randomUUID()
    const insert = this.db.transaction(() => {
      this.db
        .prepare('INSERT INTO routines (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, name, description, now, now)
      this.insertMembers(id, habitIds)
    })
    insert()
    return this.getById(id) as Routine
  }

  /** Replaces name/description and, when given, the full member list. */
  update(id: string, fields: { name?: string; description?: string; habitIds?: string[] }): Routine {
    const now = new Date().toISOString()
    const run = this.db.transaction(() => {
      if (fields.name !== undefined) {
        this.db.prepare('UPDATE routines SET name = ?, updated_at = ? WHERE id = ?').run(fields.name, now, id)
      }
      if (fields.description !== undefined) {
        this.db.prepare('UPDATE routines SET description = ?, updated_at = ? WHERE id = ?').run(fields.description, now, id)
      }
      if (fields.habitIds !== undefined) {
        this.db.prepare('DELETE FROM routine_habits WHERE routine_id = ?').run(id)
        this.insertMembers(id, fields.habitIds)
      }
    })
    run()
    return this.getById(id) as Routine
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM routines WHERE id = ?').run(id)
  }

  private insertMembers(routineId: string, habitIds: string[]): void {
    const statement = this.db.prepare(
      'INSERT INTO routine_habits (routine_id, habit_id, position) VALUES (?, ?, ?)'
    )
    habitIds.forEach((habitId, index) => statement.run(routineId, habitId, index))
  }
}
