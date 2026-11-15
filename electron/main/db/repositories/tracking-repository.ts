import { randomUUID } from 'node:crypto'
import type { DatabaseInstance } from '../connection'
import type { HabitDayOverride, HabitEntry } from '@shared/types'

/**
 * All tracking SQL (entries, day overrides, timer sessions) lives here.
 * Persistence only — validation and rules belong to TrackingService.
 */

interface EntryRow {
  id: string
  habit_id: string
  date: string
  type: string
  value: number
  created_at: string
  updated_at: string
}

interface OverrideRow {
  habit_id: string
  date: string
  status: string
  created_at: string
  updated_at: string
}

interface SessionRow {
  id: string
  habit_id: string
  date: string
  started_at: string | null
  accumulated_seconds: number
  status: string
}

function mapEntry(row: EntryRow): HabitEntry {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    type: row.type as HabitEntry['type'],
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapOverride(row: OverrideRow): HabitDayOverride {
  return {
    habitId: row.habit_id,
    date: row.date,
    status: row.status as HabitDayOverride['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface SessionRecord {
  id: string
  habitId: string
  date: string
  startedAt: string | null
  accumulatedSeconds: number
  status: 'running' | 'paused'
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    startedAt: row.started_at,
    accumulatedSeconds: row.accumulated_seconds,
    status: row.status as SessionRecord['status']
  }
}

export class TrackingRepository {
  constructor(private readonly db: DatabaseInstance) {}

  // ---- Entries ----

  listEntriesForDate(date: string): HabitEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM habit_entries WHERE date = ? ORDER BY created_at ASC')
      .all(date) as EntryRow[]
    return rows.map(mapEntry)
  }

  listEntriesBetween(fromDate: string, toDate: string): HabitEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM habit_entries WHERE date >= ? AND date <= ?')
      .all(fromDate, toDate) as EntryRow[]
    return rows.map(mapEntry)
  }

  insertEntry(habitId: string, date: string, type: HabitEntry['type'], value: number): HabitEntry {
    const now = new Date().toISOString()
    const entry: HabitEntry = {
      id: randomUUID(),
      habitId,
      date,
      type,
      value,
      createdAt: now,
      updatedAt: now
    }
    this.db
      .prepare(
        `INSERT INTO habit_entries (id, habit_id, date, type, value, created_at, updated_at)
         VALUES (@id, @habitId, @date, @type, @value, @createdAt, @updatedAt)`
      )
      .run({
        id: entry.id,
        habitId: entry.habitId,
        date: entry.date,
        type: entry.type,
        value: entry.value,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      })
    return entry
  }

  deleteBooleanEntries(habitId: string, date: string): void {
    this.db
      .prepare("DELETE FROM habit_entries WHERE habit_id = ? AND date = ? AND type = 'boolean'")
      .run(habitId, date)
  }

  deleteQuantityEntries(habitId: string, date: string): void {
    this.db
      .prepare("DELETE FROM habit_entries WHERE habit_id = ? AND date = ? AND type = 'quantity'")
      .run(habitId, date)
  }

  // ---- Day overrides ----

  listOverridesForDate(date: string): HabitDayOverride[] {
    const rows = this.db
      .prepare('SELECT * FROM habit_day_overrides WHERE date = ?')
      .all(date) as OverrideRow[]
    return rows.map(mapOverride)
  }

  listOverridesBetween(fromDate: string, toDate: string): HabitDayOverride[] {
    const rows = this.db
      .prepare('SELECT * FROM habit_day_overrides WHERE date >= ? AND date <= ?')
      .all(fromDate, toDate) as OverrideRow[]
    return rows.map(mapOverride)
  }

  upsertOverride(habitId: string, date: string, status: HabitDayOverride['status']): void {
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO habit_day_overrides (habit_id, date, status, created_at, updated_at)
         VALUES (@habitId, @date, @status, @now, @now)
         ON CONFLICT(habit_id, date) DO UPDATE SET
           status = excluded.status, updated_at = excluded.updated_at`
      )
      .run({ habitId, date, status, now })
  }

  deleteOverride(habitId: string, date: string): void {
    this.db.prepare('DELETE FROM habit_day_overrides WHERE habit_id = ? AND date = ?').run(habitId, date)
  }

  // ---- Timer sessions ----

  getActiveSession(): SessionRecord | null {
    const row = this.db
      .prepare("SELECT * FROM timer_sessions WHERE status IN ('running', 'paused') LIMIT 1")
      .get() as SessionRow | undefined
    return row ? mapSession(row) : null
  }

  getSessionForHabit(habitId: string): SessionRecord | null {
    const row = this.db
      .prepare("SELECT * FROM timer_sessions WHERE habit_id = ? AND status IN ('running', 'paused')")
      .get(habitId) as SessionRow | undefined
    return row ? mapSession(row) : null
  }

  insertSession(habitId: string, date: string, startedAt: string): SessionRecord {
    const record: SessionRecord = {
      id: randomUUID(),
      habitId,
      date,
      startedAt,
      accumulatedSeconds: 0,
      status: 'running'
    }
    this.db
      .prepare(
        `INSERT INTO timer_sessions (id, habit_id, date, started_at, accumulated_seconds, status, created_at, updated_at)
         VALUES (@id, @habitId, @date, @startedAt, @accumulatedSeconds, @status, @now, @now)`
      )
      .run({ ...record, accumulatedSeconds: record.accumulatedSeconds, now: new Date().toISOString() })
    return record
  }

  updateSession(record: SessionRecord): void {
    this.db
      .prepare(
        `UPDATE timer_sessions SET started_at = @startedAt,
           accumulated_seconds = @accumulatedSeconds, status = @status, updated_at = @now
         WHERE id = @id`
      )
      .run({
        id: record.id,
        startedAt: record.startedAt,
        accumulatedSeconds: record.accumulatedSeconds,
        status: record.status,
        now: new Date().toISOString()
      })
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM timer_sessions WHERE id = ?').run(id)
  }
}
