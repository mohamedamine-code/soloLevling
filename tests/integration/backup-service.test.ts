import { writeFileSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initDatabase } from '../../electron/main/db'
import type { DatabaseInstance } from '../../electron/main/db/connection'
import { HabitRepository } from '../../electron/main/db/repositories/habit-repository'
import { HabitService } from '../../electron/main/services/habit-service'
import {
  BackupService,
  CURRENT_SCHEMA_VERSION
} from '../../electron/main/services/backup-service'
import { ServiceError } from '../../electron/main/services/habit-service'

let tempDir: string
let backupDir: string
let db: DatabaseInstance
let habits: HabitRepository
let habitService: HabitService
let backupService: BackupService

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'sololeving-backup-live-'))
  backupDir = mkdtempSync(join(tmpdir(), 'sololeving-backup-target-'))
  db = initDatabase(tempDir)
  habits = new HabitRepository(db)
  habitService = new HabitService(habits)
  backupService = new BackupService({ userDataPath: tempDir, dbFileName: 'sololeving.db' })
})

afterEach(() => {
  try {
    db.close()
  } catch {
    // Already closed (e.g. a restore test swapped the connection out).
  }
  rmSync(tempDir, { recursive: true, force: true })
  rmSync(backupDir, { recursive: true, force: true })
})

function createHabit(name: string) {
  return habitService.create({
    name,
    category: 'health',
    trackingType: 'boolean'
  })
}

describe('backup export', () => {
  it('produces a file that validates and contains the data', async () => {
    createHabit('Read')
    const target = join(backupDir, 'backup.db')

    await backupService.exportToFile(db, target)

    expect(backupService.fileSizeBytes(target)).toBeGreaterThan(0)
    expect(() => backupService.validateBackupFile(target)).not.toThrow()
    expect(backupService.maxMigrationVersion(target)).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('works while the live connection stays open', async () => {
    createHabit('Meditate')
    const target = join(backupDir, 'backup.db')

    await backupService.exportToFile(db, target)

    // The export must not have closed or broken the live connection.
    expect(habits.listAll()).toHaveLength(1)
  })
})

describe('backup validation', () => {
  it('rejects files that are not SQLite databases', () => {
    const notDb = join(backupDir, 'garbage.db')
    writeFileSync(notDb, 'this is not a database')

    expect(() => backupService.validateBackupFile(notDb)).toThrow(ServiceError)
    expect(() => backupService.validateBackupFile(notDb)).toThrow(
      /not a readable SQLite database/
    )
  })

  it('rejects missing files', () => {
    expect(() => backupService.validateBackupFile(join(backupDir, 'nope.db'))).toThrow(
      ServiceError
    )
  })

  it('rejects valid SQLite files that are not soloLeving backups', () => {
    const foreign = join(backupDir, 'foreign.db')
    const foreignDb = new Database(foreign)
    foreignDb.exec('CREATE TABLE unrelated (id INTEGER)')
    foreignDb.close()

    expect(() => backupService.validateBackupFile(foreign)).toThrow(
      /not a soloLeving backup/
    )
  })
})

describe('backup restore (swap-in)', () => {
  it('replaces live data with the backup contents and reports the schema version', async () => {
    // Live state: habit A only -> backup.
    createHabit('Habit A')
    const target = join(backupDir, 'backup.db')
    await backupService.exportToFile(db, target)

    // Live state now: A + B (B would be lost by a restore).
    createHabit('Habit B')

    // Swap the backup in: closes the live connection atomically.
    const result = backupService.swapInBackupFile(db, target)
    expect(result.backupSchemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    // Reopen after the swap — data must match the backup (A only).
    const reopened = initDatabase(tempDir)
    const restored = new HabitRepository(reopened).listAll()
    expect(restored).toHaveLength(1)
    expect(restored[0]?.name).toBe('Habit A')
    reopened.close()
  })

  it('keeps a .pre-restore safety copy of the live database', async () => {
    createHabit('Safety')
    const target = join(backupDir, 'backup.db')
    await backupService.exportToFile(db, target)

    backupService.swapInBackupFile(db, target)

    const safetyPath = join(tempDir, 'sololeving.db.pre-restore')
    expect(backupService.fileSizeBytes(safetyPath)).toBeGreaterThan(0)
  })
})
