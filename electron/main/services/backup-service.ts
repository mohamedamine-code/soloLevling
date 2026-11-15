import Database from 'better-sqlite3'
import { copyFileSync, existsSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { DatabaseInstance } from '../db/connection'
import { MIGRATIONS } from '../db/migrations'
import { ServiceError } from './habit-service'

/**
 * Database backup and restore.
 *
 * - Export uses better-sqlite3's online backup API (`db.backup`), which
 *   produces a consistent snapshot even while the database is in use.
 * - Import validates the candidate file BEFORE touching live data
 *   (integrity check + `schema_migrations` present, versions within the
 *   current schema), keeps a one-generation safety copy of the live DB
 *   (`<db>.pre-restore`), and swaps the file atomically (temp file +
 *   rename). The caller reopens and rebuilds afterwards.
 *
 * This module is deliberately free of Electron APIs (dialogs live in the
 * IPC wiring) so it is integration-testable.
 */

const REQUIRED_TABLES = ['schema_migrations', 'habits', 'settings'] as const

export interface BackupServicePaths {
  /** Directory containing the live database file. */
  userDataPath: string
  /** Live database file name (e.g. 'sololeving.db'). */
  dbFileName: string
}

export class BackupService {
  constructor(private readonly paths: BackupServicePaths) {}

  /** Absolute path of the live database file. */
  get liveDbPath(): string {
    return join(this.paths.userDataPath, this.paths.dbFileName)
  }

  /**
   * Writes a consistent snapshot of `db` to `destinationPath` using the
   * online backup API. Resolves after the backup is complete.
   */
  exportToFile(db: DatabaseInstance, destinationPath: string): Promise<void> {
    return db.backup(destinationPath).then(() => undefined)
  }

  /**
   * Throws a ServiceError unless `backupPath` is a readable SQLite database
   * passing integrity_check and containing the required soloLeving tables
   * with migration versions inside the current schema.
   */
  validateBackupFile(backupPath: string): void {
    let candidate: Database.Database
    try {
      candidate = new Database(backupPath, { readonly: true, fileMustExist: true })
    } catch {
      throw new ServiceError('That file is not a readable SQLite database')
    }

    try {
      let integrity: string
      try {
        // The header is only validated lazily; this read is what detects a
        // non-database file.
        integrity = candidate.pragma('integrity_check', { simple: true }) as string
      } catch {
        throw new ServiceError('That file is not a readable SQLite database')
      }
      if (integrity !== 'ok') {
        throw new ServiceError('The backup file is corrupted (integrity check failed)')
      }

      const tables = candidate
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>
      const names = new Set(tables.map((table) => table.name))
      for (const required of REQUIRED_TABLES) {
        if (!names.has(required)) {
          throw new ServiceError('That file is not a soloLeving backup')
        }
      }

      const versions = (
        candidate.prepare('SELECT version FROM schema_migrations').all() as Array<{
          version: number
        }>
      ).map((row) => row.version)
      if (versions.length === 0) {
        throw new ServiceError('That backup has no migration history')
      }
      const latest = Math.max(...versions)
      if (latest > CURRENT_SCHEMA_VERSION) {
        throw new ServiceError(
          'That backup was created by a newer version of soloLeving — please update the app first'
        )
      }
    } finally {
      candidate.close()
    }
  }

  /**
   * Replaces the live database with `backupPath`. Assumes validation
   * already happened. Closes the live connection, keeps a safety copy,
   * deletes the WAL/SHM sidecars, and renames the backup into place via a
   * temp file. Returns the schema version of the swapped-in backup so the
   * caller can report how many migrations the reopen applies. The caller
   * must reopen the database afterwards.
   */
  swapInBackupFile(db: DatabaseInstance, backupPath: string): { backupSchemaVersion: number } {
    const backupSchemaVersion = this.maxMigrationVersion(backupPath)
    const livePath = this.liveDbPath
    const walPath = `${livePath}-wal`
    const shmPath = `${livePath}-shm`
    const safetyPath = `${livePath}.pre-restore`
    const tempPath = join(dirname(livePath), `.${basename(livePath)}.restoring`)

    // Flush WAL content into the main file so the safety copy is complete.
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()

    if (existsSync(safetyPath)) unlinkSync(safetyPath)
    copyFileSync(livePath, safetyPath)

    for (const sidecar of [walPath, shmPath, livePath]) {
      if (existsSync(sidecar)) unlinkSync(sidecar)
    }
    if (existsSync(tempPath)) unlinkSync(tempPath)
    copyFileSync(backupPath, tempPath)
    renameSync(tempPath, livePath)

    return { backupSchemaVersion }
  }

  /** Highest migration version recorded in a database file (0 if none). */
  maxMigrationVersion(path: string): number {
    const probe = new Database(path, { readonly: true, fileMustExist: true })
    try {
      const rows = probe
        .prepare('SELECT version FROM schema_migrations')
        .all() as Array<{ version: number }>
      return rows.reduce((max, row) => Math.max(max, row.version), 0)
    } finally {
      probe.close()
    }
  }

  /** File size of an existing file (0 when missing). */
  fileSizeBytes(path: string): number {
    try {
      return statSync(path).size
    } catch {
      return 0
    }
  }
}

/**
 * The highest migration version the running app knows (derived from the
 * migration registry so it can never drift). Backups from newer versions
 * are rejected so migrations never run backwards.
 */
export const CURRENT_SCHEMA_VERSION = Math.max(...MIGRATIONS.map((migration) => migration.version))
