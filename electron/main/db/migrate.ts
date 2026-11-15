import type { DatabaseInstance } from './connection'

export interface Migration {
  version: number
  name: string
  sql: string
}

/**
 * Applies pending migrations, newest-required first, each in its own
 * transaction and recorded in `schema_migrations`.
 *
 * Migration SQL files live in `database/migrations/` and are imported with
 * Vite's `?raw` suffix so their content is inlined at build time — no file
 * lookup needed at runtime (works identically in dev and packaged builds).
 */
export function runMigrations(db: DatabaseInstance, migrations: Migration[]): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`
  )

  const appliedVersions = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  )

  const ordered = [...migrations].sort((a, b) => a.version - b.version)

  for (const migration of ordered) {
    if (appliedVersions.has(migration.version)) continue
    applyMigration(db, migration)
  }
}

function applyMigration(db: DatabaseInstance, migration: Migration): void {
  const apply = db.transaction(() => {
    db.exec(migration.sql)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      new Date().toISOString()
    )
  })
  apply()
}
