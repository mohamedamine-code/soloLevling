# Database Schema

> Implemented through migration 0002 (2026-11-14). Phases 4+ will not add tables
> until routines (Phase 5).

## Principles

- SQLite via `better-sqlite3`, accessed **exclusively** in the Electron main process.
- File location: `app.getPath('userData')/sololeving.db` (i.e.
  `%APPDATA%\soloLeving\sololeving.db` on Windows), never inside the installation folder.
- WAL journal mode, `foreign_keys = ON`, `synchronous = NORMAL` on every connection.
- Versioned SQL migrations in `database/migrations/`, registered in
  `electron/main/db/migrations.ts`, tracked in the `schema_migrations` table. Migration
  files are inlined at build time via Vite `?raw` imports — no runtime file lookup.
- All day keys stored as local `YYYY-MM-DD` text; timestamps as ISO-8601 text.
- Repository layer owns all SQL (`electron/main/db/repositories/`); services own
  business rules; renderer reaches data only through typed IPC.

## Tables

### `schema_migrations`
`version` INTEGER PK · `applied_at` TEXT.

### `habits`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID |
| `name` | TEXT | trim length > 0 |
| `description` | TEXT | default '' |
| `category` | TEXT | CHECK: spiritual/health/learning/productivity/personal |
| `tracking_type` | TEXT | CHECK: boolean/quantity/duration |
| `target_value` | REAL | CHECK > 0; boolean habits always 1 |
| `unit` | TEXT | '' for boolean habits |
| `icon` | TEXT | lucide name |
| `color` | TEXT | hex from the fixed palette |
| `sort_order` | INTEGER | display order |
| `is_active` | INTEGER | 0/1 (0 while archived) |
| `created_at` / `updated_at` / `archived_at` | TEXT | archived_at NULL when active |

### `habit_schedules`
One row per habit (`habit_id` PK, FK → habits ON DELETE CASCADE).

| Column | Type | Notes |
| --- | --- | --- |
| `type` | TEXT | CHECK: daily / weekdays |
| `weekdays` | TEXT | CSV of 0–6 (Sun–Sat), '' when daily |
| `start_date` | TEXT | YYYY-MM-DD (inclusive) |
| `end_date` | TEXT nullable | YYYY-MM-DD (inclusive), NULL = open-ended |

### `settings`
`key` TEXT PK · `value` TEXT. Simple key/value preferences.

## Indexes

- `idx_habits_sort_order (sort_order)`
- `idx_habits_archived_at (archived_at)`
- `idx_entries_boolean_unique (habit_id, date)` — **partial**, `WHERE type = 'boolean'`
- `idx_entries_habit_date (habit_id, date)`
- `idx_entries_date (date)`
- `idx_overrides_date (date)`

### `habit_entries`
Daily tracking records. Boolean habits get exactly one row per day (partial unique
index); quantity/duration habits accumulate over multiple rows.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID |
| `habit_id` | TEXT | FK → habits ON DELETE CASCADE |
| `date` | TEXT | local `YYYY-MM-DD`, GLOB-validated |
| `type` | TEXT | CHECK: boolean/quantity/duration |
| `value` | REAL | ≥ 0; boolean rows always 1, quantity = units, duration = minutes (may be fractional) |
| `created_at` / `updated_at` | TEXT | ISO-8601 |

### `habit_day_overrides`
Explicit per-habit/per-day status overrides. Currently only `skipped`.

| Column | Type | Notes |
| --- | --- | --- |
| `habit_id`, `date` | TEXT | composite PK; FK → habits ON DELETE CASCADE |
| `status` | TEXT | CHECK: `skipped` |
| `created_at` / `updated_at` | TEXT | ISO-8601 |

A skipped day removes the habit from the progress denominator and pauses streaks;
it never creates entries.

### `timer_sessions`
Persisted timer state for duration habits. At most one active (`running` or
`paused`) session exists app-wide (enforced by `TrackingService`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID |
| `habit_id` | TEXT | FK → habits ON DELETE CASCADE |
| `date` | TEXT | day the session belongs to (its start date) |
| `started_at` | TEXT nullable | ISO-8601; NULL while paused |
| `accumulated_seconds` | REAL | ≥ 0; frozen on pause |
| `status` | TEXT | CHECK: running/paused |
| `created_at` / `updated_at` | TEXT | ISO-8601 |

Elapsed time = `accumulated_seconds + (now − started_at)` while running — computed
on read, so app restarts never lose running time. Stopping deletes the row and
commits the elapsed minutes as a `habit_entries` duration record (0.1 min
precision; < 0.1 min leaves no entry).

### `routines` / `routine_habits` (migration 0003)

Routines are reusable, named, ordered groups of existing habits (morning, evening,
gym). They never duplicate habit data — `routine_habits` only stores references.

| Column (`routines`) | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID |
| `name` | TEXT | `length(name) > 0` enforced in SQL |
| `description` | TEXT | default `''` |
| `created_at` / `updated_at` | TEXT | ISO-8601 |

| Column (`routine_habits`) | Type | Notes |
| --- | --- | --- |
| `routine_id` + `habit_id` | composite PK | FK ��' routines AND habits, both `ON DELETE CASCADE` |
| `position` | INTEGER | CHECK `position >= 0`; display/check order |

Indexes: `idx_routine_habits_order (routine_id, position)` for ordered reads and
`idx_routine_habits_habit (habit_id)` for habit-delete cascades. Deleting a habit
or a routine cascades cleanly in both directions; member resolution happens on
read via `HabitRepository` (single source of habit data), so archived habits
disappear from routines automatically.

## Retention & backup

No automatic deletion of user data. Deleting a habit cascades to its schedule,
entries, overrides, and timer sessions.

Backup/restore (implemented, Phase 7a) lives in
`electron/main/services/backup-service.ts`:

- **Export** uses better-sqlite3's online backup API (`db.backup(path)`) — a
  consistent snapshot even while the live connection is open.
- **Restore** validates the candidate file first (integrity check, required
  tables, migration versions ≤ current schema), keeps a one-generation safety
  copy at `sololeving.db.pre-restore`, then swaps the file atomically (temp
  file + rename, WAL/SHM sidecars removed). The service graph is rebuilt and
  the renderer reloads afterwards; missing migrations are applied on reopen.
  Backups from newer app versions are rejected.

## Testing

Integration tests run the real migrations + repositories against a temp directory:
`tests/integration/habit-repository.test.ts` (migrations idempotent, CRUD,
archive/restore, cascade delete, constraints, reorder, settings) and
`tests/integration/tracking-service.test.ts` (all tracking mutations, timer
lifecycle + restart survival, skip semantics, streak computation).
