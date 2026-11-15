import type { DatabaseInstance } from '../connection'
import type { Habit, HabitSchedule } from '@shared/types'

/**
 * All habit-related SQL lives here. The repository layer knows nothing about
 * validation or business rules — that belongs to the service layer above it.
 * Rows map 1:1 to the domain `Habit` type via the row mappers below.
 */

interface HabitRow {
  id: string
  name: string
  description: string
  category: string
  tracking_type: string
  target_value: number
  unit: string
  icon: string
  color: string
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
  archived_at: string | null
}

interface ScheduleRow {
  habit_id: string
  type: string
  weekdays: string
  start_date: string
  end_date: string | null
}

function mapScheduleRow(row: ScheduleRow | undefined): HabitSchedule {
  if (!row) {
    // Defensive default: daily, starting today's data. Should not occur for
    // habits created through the service (schedule is always written).
    throw new Error('Missing schedule record for habit')
  }
  return {
    type: row.type as HabitSchedule['type'],
    weekdays:
      row.weekdays === ''
        ? []
        : row.weekdays.split(',').map((value) => Number.parseInt(value, 10)),
    startDate: row.start_date,
    endDate: row.end_date
  }
}

function mapHabitRow(habit: HabitRow, schedule: ScheduleRow | undefined): Habit {
  return {
    id: habit.id,
    name: habit.name,
    description: habit.description,
    category: habit.category as Habit['category'],
    trackingType: habit.tracking_type as Habit['trackingType'],
    targetValue: habit.target_value,
    unit: habit.unit,
    icon: habit.icon,
    color: habit.color,
    sortOrder: habit.sort_order,
    isActive: habit.is_active === 1,
    createdAt: habit.created_at,
    updatedAt: habit.updated_at,
    archivedAt: habit.archived_at,
    schedule: mapScheduleRow(schedule)
  }
}

const SELECT_HABITS = `
  SELECT h.id, h.name, h.description, h.category, h.tracking_type, h.target_value,
         h.unit, h.icon, h.color, h.sort_order, h.is_active,
         h.created_at, h.updated_at, h.archived_at,
         s.habit_id, s.type, s.weekdays, s.start_date, s.end_date
  FROM habits h
  LEFT JOIN habit_schedules s ON s.habit_id = h.id`

function weekdaysToString(weekdays: number[]): string {
  return [...weekdays].sort((a, b) => a - b).join(',')
}

export class HabitRepository {
  constructor(private readonly db: DatabaseInstance) {}

  listAll(): Habit[] {
    const rows = this.db
      .prepare(`${SELECT_HABITS} ORDER BY h.sort_order ASC, h.created_at ASC`)
      .all() as Array<HabitRow & ScheduleRow>
    return rows.map((row) => mapHabitRow(row, row))
  }

  getById(id: string): Habit | null {
    const row = this.db.prepare(`${SELECT_HABITS} WHERE h.id = ?`).get(id) as
      | (HabitRow & ScheduleRow)
      | undefined
    if (!row) return null
    return mapHabitRow(row, row)
  }

  getMaxSortOrder(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max FROM habits').get() as {
      max: number
    }
    return row.max
  }

  insertWithSchedule(habit: Habit): void {
    const insert = this.db.transaction((habit: Habit) => {
      this.db
        .prepare(
          `INSERT INTO habits
             (id, name, description, category, tracking_type, target_value, unit,
              icon, color, sort_order, is_active, created_at, updated_at, archived_at)
           VALUES
             (@id, @name, @description, @category, @trackingType, @targetValue, @unit,
              @icon, @color, @sortOrder, @isActive, @createdAt, @updatedAt, @archivedAt)`
        )
        .run({
          id: habit.id,
          name: habit.name,
          description: habit.description,
          category: habit.category,
          trackingType: habit.trackingType,
          targetValue: habit.targetValue,
          unit: habit.unit,
          icon: habit.icon,
          color: habit.color,
          sortOrder: habit.sortOrder,
          isActive: habit.isActive ? 1 : 0,
          createdAt: habit.createdAt,
          updatedAt: habit.updatedAt,
          archivedAt: habit.archivedAt
        })

      this.db
        .prepare(
          `INSERT INTO habit_schedules (habit_id, type, weekdays, start_date, end_date)
           VALUES (@habitId, @type, @weekdays, @startDate, @endDate)`
        )
        .run({
          habitId: habit.id,
          type: habit.schedule.type,
          weekdays: weekdaysToString(habit.schedule.weekdays),
          startDate: habit.schedule.startDate,
          endDate: habit.schedule.endDate
        })
    })
    insert(habit)
  }

  update(habit: Habit): void {
    const update = this.db.transaction((habit: Habit) => {
      this.db
        .prepare(
          `UPDATE habits SET
             name = @name, description = @description, category = @category,
             tracking_type = @trackingType, target_value = @targetValue, unit = @unit,
             icon = @icon, color = @color, sort_order = @sortOrder, is_active = @isActive,
             updated_at = @updatedAt, archived_at = @archivedAt
           WHERE id = @id`
        )
        .run({
          id: habit.id,
          name: habit.name,
          description: habit.description,
          category: habit.category,
          trackingType: habit.trackingType,
          targetValue: habit.targetValue,
          unit: habit.unit,
          icon: habit.icon,
          color: habit.color,
          sortOrder: habit.sortOrder,
          isActive: habit.isActive ? 1 : 0,
          updatedAt: habit.updatedAt,
          archivedAt: habit.archivedAt
        })

      this.db
        .prepare(
          `UPDATE habit_schedules SET
             type = @type, weekdays = @weekdays, start_date = @startDate, end_date = @endDate
           WHERE habit_id = @habitId`
        )
        .run({
          habitId: habit.id,
          type: habit.schedule.type,
          weekdays: weekdaysToString(habit.schedule.weekdays),
          startDate: habit.schedule.startDate,
          endDate: habit.schedule.endDate
        })
    })
    update(habit)
  }

  setArchived(id: string, archivedAt: string | null): void {
    this.db
      .prepare('UPDATE habits SET archived_at = @archivedAt, is_active = @isActive, updated_at = @updatedAt WHERE id = @id')
      .run({
        id,
        archivedAt,
        isActive: archivedAt === null ? 1 : 0,
        updatedAt: new Date().toISOString()
      })
  }

  delete(id: string): void {
    // habit_schedules cascades via foreign keys.
    this.db.prepare('DELETE FROM habits WHERE id = ?').run(id)
  }

  reorder(orderedIds: string[]): void {
    const reorder = this.db.transaction(() => {
      const statement = this.db.prepare('UPDATE habits SET sort_order = ? WHERE id = ?')
      orderedIds.forEach((id, index) => {
        statement.run(index, id)
      })
    })
    reorder()
  }
}
