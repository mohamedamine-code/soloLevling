# ADR-002 — SQLite as the Only Persistence Layer

**Date:** 2026-11-14 · **Status:** Accepted (implementation pending, Phase 2)

## Context

Habit definitions, daily entries, overrides, routines, and settings must survive
restarts, work fully offline, remain inspectable, and support transactional multi-table
writes with a rich query surface (history, analytics, streaks).

## Decision

**SQLite via better-sqlite3 in the Electron main process** — the single source of
persistent application data.

- DB file in `app.getPath('userData')` (writable, survives updates, per-user).
- Versioned SQL migrations tracked in a `schema_migrations` table.
- `PRAGMA foreign_keys = ON`; transactions for multi-step operations.
- Typed repository/service modules own all SQL; renderer accesses data only via IPC.

## Alternatives considered

- **JSON files** — fine for tiny state, but streak/analytics/history queries and
  transactional safety become hand-rolled and error-prone.
- **IndexedDB in renderer** — violates the "domain logic in main" boundary; hard to
  share with the widget; no cross-window transactionality.
- **Electron store / conf libraries** — settings only, not relational data.
- **SQLite alternatives (LevelDB, etc.)** — weaker query/consistency story for
  date-range analytics.

## Consequences

- (+) Native module rebuild/ABI concern is the main operational risk: when installing
  `better-sqlite3`, verify it matches the bundled Electron ABI (`electron-rebuild` if
  prebuilt binaries don't match). This must be verified during Phase 2 installation.
- (+) Deterministic SQL makes integration tests straightforward (temp-dir DB files).
- (−) Backup/restore must handle an open DB handle safely (atomic copy strategy,
  documented in `docs/database-schema.md`).
