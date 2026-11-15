# Modification: Routines, Range Analytics & History

**Date:** 2026-11-14 · **Phase:** 5 · **Status:** Implemented

## 1. Summary

Added routines (reusable ordered groups of existing habits) with full CRUD and a
"Start routine" checklist dialog, range analytics backed entirely by real tracked
data (7/30/90-day selector, consistency/average/time stat cards, daily completion
bar chart, per-habit performance table with lifetime streaks, GitHub-style
consistency heatmap), and a day-by-day History browser. Migration 0003 adds the
`routines` and `routine_habits` tables; 5 new IPC channels; Recharts 3.10.1 for
the chart.

## 2. Motivation

Phases 5 of the master plan: routines as reusable habit bundles, analytics over
real data (never counting unscheduled days as failures, no fake chart filler),
and history browsing of prior days (completed/missed/skipped).

## 3. Previous Behavior

Routines, Analytics and History were pending sidebar entries with honest "in
development" empty states. Tracking existed only per-day (Today page + widget).

## 4. New Behavior

- **Routines page:** cards listing each routine with member chips (color dot +
  name), Start/Edit/Delete. "New routine" opens a form with name, optional
  description, and an ordered habit checklist (active habits only; selected
  order = check order). "Start" opens a dialog that checks off each member for
  today — boolean members toggle complete/uncomplete, quantity members get a
  +step button, duration members link to the Today page. All mutations go
  through the same tracking IPC as the dashboard, so the widget and Today page
  stay in sync via the `tracking:snapshot-changed` broadcast.
- **Analytics page:** 7/30/90-day range selector. Stat cards: Consistency
  (completed/scheduled over range), Average day (mean of non-null day percents),
  Time tracked (duration minutes in range). Daily completion bar chart
  (Recharts, `var(--…)` tokens). Per-habit table: completion rate, current +
  best streak (lifetime), total value in the habit's unit. Consistency heatmap:
  one column per week, one row per weekday, colored by day percent; days with
  nothing counted show as neutral. Honest empty state when no tracked data.
- **History page:** date picker + prev/next/Today navigation. Summary card with
  percent ring, completed/scheduled counts, and the streak as of that day. Rows
  for each habit with Completed / Partial / Missed / Skipped / Scheduled badges
  (`formatTargetProgress` for the detail line). Future days show a "Future day"
  badge; days with nothing scheduled show an honest empty state ("rest days are
  free"). Read-only by design — past days are records, not editable surfaces.
- **Sidebar:** habits, routines, analytics, history pending flags removed — all
  views are real.

## 5. Files Created

### Main process
- `electron/main/db/repositories/routine-repository.ts` — routine SQL, member
  resolution via `HabitRepository`, transactional create/update
- `electron/main/services/routine-service.ts` — validation + member rules

### Migrations
- `database/migrations/0003_routines.sql` — `routines`, `routine_habits` + indexes

### Shared
- `shared/validation/routine.ts` — Zod schemas (name/description/habitIds)
- `shared/types/index.ts` — Routine, inputs, DaySummaryPoint, HabitRangeStats,
  RangeAnalytics (extended)

### Renderer
- `src/stores/routines-store.ts` — routine state, error surfacing
- `src/features/routines/RoutineFormDialog.tsx` — create/edit form
- `src/features/routines/StartRoutineDialog.tsx` — per-member quick actions

### Tests
- `tests/integration/routine-service.test.ts` — 7 tests
- `tests/integration/range-analytics.test.ts` — 6 tests

## 6. Files Modified

- `electron/main/db/migrations.ts` — registered migration 3
- `electron/main/db/repositories/routine-repository.ts` (post-review fixes)
- `electron/main/services/tracking-service.ts` — `getRangeAnalytics()` (~190 lines)
- `electron/main/ipc/register-handlers.ts` — 5 new channels + routine wiring
- `electron/main/index.ts` — RoutineRepository/RoutineService wiring
- `electron/preload/index.ts` — `tracking.getRange`, `routines.*`
- `shared/constants/ipc-channels.ts` — 5 new channel names
- `shared/contracts/api.ts` — routines + getRange API surfaces
- `src/features/routines/RoutinesPage.tsx` — full UI replacing pending state
- `src/features/analytics/AnalyticsPage.tsx` — full UI (Recharts + heatmap)
- `src/features/history/HistoryPage.tsx` — full UI (day browser)
- `src/app/router/views.ts` — pending flags removed
- `package.json` — added `recharts`
- Docs: `docs/database-schema.md`, `docs/ipc-contracts.md`, `docs/agent-handoff.md`,
  `docs/architecture.md`, `README.md`, `CHANGELOG.md`

## 7. Architecture

- Routines: renderer → `routines.*` IPC → `RoutineService` (Zod validation,
  member rules: exist, active, unique) → `RoutineRepository` (transactions) →
  SQLite. Members resolve to live `Habit` objects on read; a routine whose
  members all vanish never renders hollow.
- Analytics: a single main-process pass over the fetched window (`schedule
  start → today`). Per-day and per-habit aggregates reuse the SAME shared domain
  functions as the dashboard/widget (`isHabitCountedOn`, `habitActualValue`,
  `habitProgress`, `computeDayProgress`, `computeHabitStreaks`) — no formula
  duplication anywhere.
- React Compiler compliance: dialogs and range/day views are key-remounted
  (`RoutineFormDialog` keyed by `editing?.id ?? 'new'`, `AnalyticsContent` keyed
  by rangeDays, `HistoryContent` keyed by selectedDate) so state initializes from
  props — no setState-in-effect resets.

## 8. Database Changes

Migration `0003_routines.sql` (registered version 3): `routines` (id, name,
description, timestamps) and `routine_habits` (composite PK, FKs to both tables
with ON DELETE CASCADE, ordered `position`), plus two indexes. See
`docs/database-schema.md`. No changes to existing tables.

## 9. IPC Changes

5 new channels: `tracking:get-range`, `routines:list|create|update|delete`. Full
contracts in `docs/ipc-contracts.md`. All routine inputs are Zod-validated in the
main process; `getRange` validates both date keys and rejects inverted ranges.

## 10. UI Changes

- Routines: form dialog validates name client-side and mirrors server errors;
  delete is confirmed (routine-only, message states habits are untouched).
- Start routine dialog: honest per-type affordances; duration habits show
  "Track on Today" instead of a dead button; skipped members render muted.
- Analytics: empty state explains that unscheduled days never count against the
  user; heatmap legend (less → more); table rows show streaks with correct
  singular/plural.
- History: cannot navigate into the future (next button disabled, date input
  `max` = today); "Missed" only appears for past days.
- All icons Lucide at strokeWidth 1.75; no hardcoded hex colors — CSS tokens or
  inline `var(--…)` in SVG chart options.

## 11. Testing

- `routine-service.test.ts` (integration, real temp DB): create with ordered
  members, list resolution, partial update preserving fields, member-list
  replacement, delete not touching habits, rejection of unknown ids/empty
  names/missing/duplicate members, archived-habit rejection.
- `range-analytics.test.ts`: per-day aggregation (percent/completed/missed),
  skip semantics (skipped excluded from denominator, counted separately),
  per-habit rates + lifetime streaks + totals (quantity and duration), clamping
  of future days, empty future ranges, inverted-range rejection.

## 12. Verification

Executed on 2026-11-14:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | ✅ zero errors (both projects) |
| `npm.cmd run lint` | ✅ zero errors |
| `npm.cmd run test` | ✅ 97/97 passed (9 files) |
| `npm.cmd run build` | ✅ all three bundles emitted (main 121ms, preload 42ms, renderer 2.93s) |
| `electron.cmd scripts/db-probe.cjs` (after launch) | ✅ integrity ok; `schema_migrations` contains versions 1–3; tables `routines`, `routine_habits` present |
| Launch `electron .` | ✅ app running with the new build for manual page verification |

## 13. Known Issues

- Routine members render as chips; drag-and-drop reordering inside the form is
  not implemented (selection order defines order).
- The heatmap uses `title` tooltips (no custom floating tooltip yet).
- Analytics does not yet refresh live on tracking mutations (a reload of the
  range happens on range change or page revisit).
- Duration habits inside a routine link to the Today page; there is no inline
  timer in the routine dialog.
- `npm audit` reports pre-existing transitive advisories (Recharts dep tree).

## 14. Future Considerations

- Phase 6 (notifications + tray) may broadcast reminders for routine start
  times; keep routine data shape stable.
- Consider a `tracking:snapshot-changed`-driven analytics refresh hook when the
  dashboard is open — reuse the same subscribe pattern.
- Routine templates/export belong to the backup phase (7).
- If ranges grow beyond 90 days, consider caching `getRange` results per day
  instead of recomputing the full window per call.

## 15. AI Agent Handoff

- Start from `docs/agent-handoff.md`; routines backend is
  `routine-service.ts` → `routine-repository.ts`; analytics backend is
  `getRangeAnalytics()` in `tracking-service.ts`.
- The analytics aggregation MUST keep using the shared domain functions in
  `shared/domain/` — never re-implement progress or streak math.
- Routine members are references only: if you add a `routines.*` field, update
  the Zod schema (`shared/validation/routine.ts`), the service, the repository
  mapper, `shared/types`, `shared/contracts/api.ts`, and the docs.
- The React Compiler forbids setState-in-effect: use the key-remount pattern
  shown in `RoutineFormDialog`/`AnalyticsContent`/`HistoryContent` for any new
  "reset on open/change" surface.
