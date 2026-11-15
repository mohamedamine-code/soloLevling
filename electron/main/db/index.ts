import { openDatabase, type DatabaseInstance } from './connection'
import { runMigrations } from './migrate'
import { MIGRATIONS } from './migrations'

export type { DatabaseInstance } from './connection'
export { runMigrations } from './migrate'
export type { Migration } from './migrate'
export { MIGRATIONS } from './migrations'

/**
 * Opens the application database and ensures the schema is current.
 * The instance is shared for the app's lifetime (better-sqlite3 is synchronous;
 * calls are cheap and the main process is single-threaded).
 */
export function initDatabase(userDataPath: string): DatabaseInstance {
  const db = openDatabase(userDataPath)
  runMigrations(db, MIGRATIONS)
  return db
}
