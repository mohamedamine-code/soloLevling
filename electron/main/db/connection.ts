import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type DatabaseInstance = Database.Database

/**
 * Opens (and creates if needed) the soloLeving database.
 *
 * The database lives in Electron's userData directory — writable, per-user,
 * and outside the installation folder (see ADR-002).
 */
export function openDatabase(userDataPath: string, fileName = 'sololeving.db'): DatabaseInstance {
  const filePath = join(userDataPath, fileName)
  mkdirSync(dirname(filePath), { recursive: true })

  const db = new Database(filePath)

  // Durability and integrity settings, applied on every connection.
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  return db
}
