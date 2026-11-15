# Modification: Database & Habit Management

**Date:** 2026-11-14 · **Phase:** 2 · **Status:** Implemented

## 1. Summary

Added the SQLite persistence layer (better-sqlite3 in the main process) with a versioned
migration system, habit entities with schedules, settings storage, and a full habit
management UI wired over typed IPC: create, edit, archive, restore, delete (with
confirmation), search, category filtering, and reordering. The Today dashboard now
shows real scheduled habits.

## 2. Motivation

Phase 2 of the master plan: habits must survive restarts and the tracking engine
(Phase 3) needs a solid, constraint-enforced data foundation.

## 3. Previous Behavior

No persistence. My Habits and Today were static shells with honest "in development"
empty states. The only IPC channel was `app:get-info`.

## 4. New Behavior

- Launching the app creates `%APPDATA%\soloLeving\sololeving.db` (WAL mode, foreign
  keys ON) and applies migrations automatically.
- My Habits page: real CRUD. "New habit" opens a validated form (name, description,
  category, color, tracking type, target/unit, schedule with daily/weekday selection,
  start/end dates). Rows support edit, archive/restore, delete-with-confirm, and
  up/down reordering. Search filters by name/description; a category select filters
  the list; an "Archived" toggle reveals archived habits.
- Today page: lists habits actually scheduled today (grouped by category) with an
  honest "Tracking pending" badge — daily tracking is Phase 3. Empty states for
  "no habits" and "nothing scheduled today".
- Persistence verified across restarts (SQLite file).

## 5. Files Created

### Main process — database
- `electron/main/db/connection.ts` — open DB in userData, PRAGMAs
- `electron/main/db/migrate.ts` — transactional migration runner (`schema_migrations`)
- `electron/main/db/migrations.ts` — ordered migration registry
- `electron/main/db/index.ts` — `initDatabase()`
- `electron/main/db/repositories/habit-repository.ts` — all habit SQL
- `electron/main/db/repositories/settings-repository.ts` — key/value settings

### Main process — service & IPC
- `electron/main/services/habit-service.ts` — validation + business rules
- `electron/main/ipc/register-handlers.ts` — extended with habits/settings channels

### Migrations
- `database/migrations/0001_init.sql` — habits, habit_schedules, settings,
  schema_migrations, indexes, CHECK constraints

### Shared
- `shared/types/index.ts` — Habit, HabitSchedule, create/update inputs (extended)
- `shared/validation/habit.ts` — Zod schemas + category/tracking/palette constants
- `shared/constants/categories.ts` — category display labels
- `shared/constants/ipc-channels.ts` — 9 new channels
- `shared/contracts/api.ts` — habits + settings API surfaces
- `shared/domain/schedule.ts` — `isScheduledOn()` scheduling predicate
- `shared/utils/date.ts` — local date-key helpers (moved from renderer so main and
  renderer share one implementation)

### Renderer
- `src/stores/habits-store.ts` — habit state + optimistic reorder with rollback
- `src/features/habits/HabitFormDialog.tsx` — create/edit form (Zod-validated client side)
- `src/features/habits/HabitRow.tsx` — list row with row actions
- `src/components/ui/Dialog.tsx` — modal primitive
- `src/components/ui/Form.tsx` — Input, Textarea, Select, Field, Segmented
- `src/components/ui/ConfirmDialog.tsx` — destructive confirmation
- `src/components/ui/HabitIcon.tsx` — icon-name → Lucide registry

### Tests & tooling
- `tests/integration/habit-repository.test.ts` — 17 integration tests
- `tests/unit/schedule.test.ts` — 7 scheduling tests (caught a real bug)
- `scripts/sqlite-probe.cjs` — Electron ABI probe for better-sqlite3

## 6. Files Modified

- `electron/main/index.ts` — database/service init before IPC registration
- `electron/preload/index.ts` — exposes habits + settings
- `src/features/dashboard/TodayPage.tsx` — real scheduled habits, grouped by category
- `src/features/habits/HabitsPage.tsx` — full management UI replacing the pending state
- `src/utils/date.ts` — re-exports shared date helpers
- `src/styles/global.css` — dialog keyframes
- `tsconfig.node.json` — added `vite/client` types (for `?raw` imports), removed deprecated `baseUrl`
- `vitest.config.mts` — `import.meta.dirname` (fixes Vite warning)
- `eslint.config.mjs` — node globals for `scripts/*.cjs`
- `package.json` — added `better-sqlite3`, `zod`, `@types/better-sqlite3`
- Docs: `docs/database-schema.md`, `docs/ipc-contracts.md`, `docs/agent-handoff.md`,
  `CHANGELOG.md`

## 7. Architecture

Data flows renderer → preload (`window.soloLeving.habits.*`) → IPC handlers →
`HabitService` (Zod validation, normalization, defaults) → `HabitRepository` (SQL) →
SQLite. The service throws `ServiceError`; its message propagates to the renderer
for display in form/dialog banners.

Scheduling logic (`isScheduledOn`) lives in `shared/domain/schedule.ts` — a pure
function used by the Today page now and by the progress engine/widget in Phase 3+.
It must remain the single copy.

## 8. Database Changes

Migration `0001_init.sql` (initial schema) — see `docs/database-schema.md` for the
full column reference. CHECK constraints enforce category/tracking-type enums and
`target_value > 0` at the SQL level; schedule is 1:1 with habits and cascades on delete.

## 9. IPC Changes

9 new channels: `habits:list|create|update|archive|restore|delete|reorder` and
`settings:get|set`. Full contracts in `docs/ipc-contracts.md`. All habit inputs are
Zod-validated in the main process; settings keys/values are length/shape checked.

## 10. UI Changes

- New reusable components: Dialog, Form controls, ConfirmDialog, HabitIcon.
- Habit form covers all Phase-2 fields with inline validation errors and a shared
  Zod schema (single source of truth for validation rules).
- Delete requires explicit confirmation; archive is one click (restorable).
- Reordering shows up/down chevrons (drag-and-drop deferred to a later phase).
- Dialog animations are subtle and respect `prefers-reduced-motion`.

## 11. Testing

- Integration (real temp DB): migrations idempotency, CRUD, defaults (boolean target=1,
  icon per category), invalid inputs rejected (no target, bad category, empty weekday
  set, end<start), rename/partial update preserving weekdays, boolean conversion
  forcing target 1, unknown id errors, archive/restore, cascade delete, reorder
  persistence, settings round-trip.
- Unit: `isScheduledOn` (daily, weekday, inclusive range bounds, malformed keys).
- The malformed-key test caught and fixed a real bug (daily path skipped validation).

## 12. Verification

Executed on 2026-11-14:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | ✅ zero errors |
| `npm.cmd run test` | ✅ 33/33 passed (3 files) |
| `npm.cmd run lint` | ✅ no errors |
| `npm.cmd run build` | ✅ all three bundles emitted |
| Electron ABI probe (`electron.cmd scripts/sqlite-probe.cjs`) | ✅ `SQLITE_PROBE_OK rows=1` — better-sqlite3 loads natively in Electron, no rebuild needed |
| Launch `electron .` | ✅ 4 processes stable; DB created at `%APPDATA%\soloLeving\sololeving.db`; `schema_migrations` contains version 1; tables `habits`, `habit_schedules`, `settings`, `schema_migrations` present |

## 13. Known Issues

- Timer/duration sessions do not exist yet (Phase 3); `duration` habits only store
  their target today.
- Reordering is disabled while searching/filtering (order is defined over the full list).
- No toast notifications yet — errors surface as inline banners.
- The icon field stores a lucide name but there is no icon picker; defaults derive
  from the category.
- `npm audit` still reports the 7 moderate dev-dependency advisories.

## 14. Future Considerations

- Phase 3 adds `habit_entries` + `habit_day_overrides` via migration 0002; keep the
  repository/service layering intact.
- When multiple windows exist (widget), habit mutations must push updates to all
  renderer windows (typed events) instead of each window polling.
- The settings API is unused by the UI; migrate the theme store to it in Phase 3/4
  so preferences live in SQLite, not localStorage.

## 15. AI Agent Handoff

- Start from `docs/agent-handoff.md`, then `docs/database-schema.md` and
  `docs/ipc-contracts.md`.
- Habit flow: `habit-service.ts` (rules) is the place for new business logic;
  `habit-repository.ts` only maps rows.
- To add a column: new migration file + register in `migrations.ts` + update types,
  Zod schema, service normalization, repository mappers, and this doc.
- Do not import `better-sqlite3` anywhere in `src/` (renderer) — enforced by design;
  keep it that way.
