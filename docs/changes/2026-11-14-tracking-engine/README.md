# Modification: Tracking Engine & Interactive Today Dashboard

**Date:** 2026-11-14 · **Phase:** 3 · **Status:** Implemented

## 1. Summary

The heart of the app: daily tracking for all three habit types (boolean, quantity,
duration), persisted timer sessions that survive restarts, explicit skip overrides,
a shared progress engine, schedule-aware streaks, and an interactive Today dashboard
(progress ring, per-habit controls, live timer readout). All tracking mutations
return a fresh `DaySnapshot` — the single source of truth the dashboard (and the
future widget) render from.

## 2. Motivation

Phase 3 of the master plan: habits were manageable but not trackable. The widget
(Phase 4) needs the exact same progress/streak math, so the engines had to become
pure, shared domain code before any UI was built on top.

## 3. Previous Behavior

Phase 2: Today listed habits scheduled today with a static "Tracking pending" badge.
No entries, no timers, no progress, no streaks. `duration` habits stored only a
target; clicking them did nothing.

## 4. New Behavior

- **Boolean habits**: one click toggles completed/not (DB unique index makes
  duplicates impossible).
- **Quantity habits**: ± buttons with a smart step (`quantityStep`: target ≥ 30 →
  target/10, else 1) plus an editable value (commit on blur/Enter, clamped at 0).
- **Duration habits**: manual minute logging (with 0.1 min precision) or a live
  timer — start/pause/resume/stop. Stopping converts elapsed seconds into a
  duration entry (0.1 min rounding). Only ONE timer may run app-wide; other rows
  disable their timer buttons with an explanatory tooltip.
- **Timers persist**: sessions live in `timer_sessions`; elapsed time is recomputed
  from `started_at`, so closing or crashing the app never loses running time.
- **Skip**: any habit can be skipped for a day — it leaves the progress denominator
  and never breaks streaks. Undo restores it.
- **Day summary**: progress ring (percent with one decimal, or an honest "–" when
  nothing counts today), "x of y habits" line, current + best overall streak badges.
- **Overall streaks**: a day counts when every scheduled, non-skipped habit is
  completed; unscheduled days neither count nor break; today (if incomplete) doesn't
  break yet.
- Timer status changes re-render via remount keys — no refs read during render
  (React Compiler purity rule).

## 5. Files Created

### Shared domain (single-copy engines)
- `shared/domain/progress.ts` — `isHabitCountedOn`, `habitActualValue`,
  `habitProgress` (clamped 0..1), `habitDayStatus`, `computeDayProgress`,
  `quantityStep`, `formatTargetProgress`
- `shared/domain/streaks.ts` — `computeOverallStreaks`, `computeHabitStreaks`
- `shared/validation/tracking.ts` — Zod: date keys, uuid, non-negative values,
  duration minutes (0.1–1440), quantity deltas
- `shared/utils/date.ts` — added `addDaysToKey`, `previousDateKey`

### Main process
- `database/migrations/0002_tracking.sql` — `habit_entries` (with partial unique
  index on boolean), `habit_day_overrides`, `timer_sessions`
- `electron/main/db/repositories/tracking-repository.ts` — all tracking SQL
- `electron/main/services/tracking-service.ts` — snapshots, mutations, timer
  lifecycle, streak computation (all inputs Zod-validated)

### Renderer
- `src/stores/tracking-store.ts` — snapshot state + all tracking actions
- `src/features/tracking/HabitTodayRow.tsx` — per-type controls (± stepper,
  editable value, manual log input, timer buttons, skip)
- `src/features/tracking/TimerDisplay.tsx` — live mm:ss / h:mm:ss readout
  (ticks locally once per second, no IPC spam) + `formatElapsedShort`
- `src/features/tracking/DaySummaryCard.tsx` — progress ring + streak badges

### Tests & tooling
- `tests/unit/progress.test.ts` — 16 unit tests (incl. the spec's 75% example)
- `tests/unit/streaks.test.ts` — 9 unit tests (breaks, pauses, today grace,
  schedule-aware counting)
- `tests/integration/tracking-service.test.ts` — 17 integration tests against a
  real temp DB (all mutation paths, timer restart survival, skip semantics,
  service-level streaks)
- `scripts/db-probe.cjs` — diagnostic: opens the live app DB and prints integrity,
  tables, and applied migrations

## 6. Files Modified

- `shared/types/index.ts` — `HabitEntry`, `HabitDayOverride`, `HabitTrackingState`,
  `DayProgress`, `OverallStreak`, `ActiveTimerSession`, `DaySnapshot`
- `shared/constants/ipc-channels.ts` — 13 new `tracking:*` channels
- `shared/contracts/api.ts` — `tracking` API surface (mutations return
  `DaySnapshot`)
- `electron/main/db/migrations.ts` — registered migration 0002
- `electron/main/index.ts` — `TrackingRepository` + `TrackingService` wired
- `electron/main/ipc/register-handlers.ts` — 13 handlers
- `electron/preload/index.ts` — exposes the tracking surface
- `src/features/dashboard/TodayPage.tsx` — rewritten around `DaySnapshot`: summary
  card, timer banner, grouped interactive rows, honest empty states
- `tsconfig.node.json` — include `scripts` (for db-probe.cjs type coverage)
- Docs: `docs/database-schema.md`, `docs/ipc-contracts.md`, `docs/agent-handoff.md`,
  `README.md`, `CHANGELOG.md`

## 7. Architecture

Two hard rules were honored:

1. **One copy of the math.** `shared/domain/progress.ts` and `streaks.ts` are pure
   functions used by `TrackingService` (main) and importable by the renderer for
   display formatting (`formatTargetProgress`, `quantityStep`). The widget in
   Phase 4 will reuse the same modules. No formula duplication.
2. **Snapshot as truth.** Every mutation (`complete`, `setQuantity`, `stopTimer`,
   `skip`, …) returns a freshly built `DaySnapshot` for the affected day. The
   renderer never mutates local snapshot state optimistically; it replaces it.
   Timer stops commit to the session's start date (a timer can span midnight).

Data flow: renderer → preload (`window.soloLeving.tracking.*`) → IPC handlers →
`TrackingService` (Zod + rules) → `TrackingRepository` (SQL) → SQLite.

## 8. Database Changes

Migration `0002_tracking.sql` — full column reference in
`docs/database-schema.md`. Highlights:

- `habit_entries`: `value REAL ≥ 0`; **partial unique index** on
  `(habit_id, date) WHERE type = 'boolean'` — DB-level idempotency.
- `habit_day_overrides`: PK `(habit_id, date)`, `status CHECK IN ('skipped')`.
- `timer_sessions`: `started_at` NULL when paused; `accumulated_seconds` +
  recomputation from `started_at` make timers crash-proof.
- All reference `habits.id` with `ON DELETE CASCADE`; deleting a habit removes its
  entries/overrides/sessions.

## 9. IPC Changes

13 new channels: `tracking:get-day`, `tracking:complete`, `tracking:uncomplete`,
`tracking:set-quantity`, `tracking:increment-quantity`, `tracking:add-duration`,
`tracking:start-timer`, `tracking:pause-timer`, `tracking:resume-timer`,
`tracking:stop-timer`, `tracking:get-active-timer`, `tracking:skip`,
`tracking:unskip`. All inputs Zod-validated in the main process. Full contracts in
`docs/ipc-contracts.md`.

## 10. UI Changes

- Today page groups tracked habits by category (same labels as My Habits), with a
  summary card up top and a subtle "timer running" banner when applicable.
- Per-type controls live in one row: check button (boolean), stepper + inline
  editable number (quantity), play/pause/stop + manual log (duration), skip/undo
  for every type.
- Completed rows show a "Done" badge; skipped rows dim with a "Skipped" badge.
- Live timer text uses a remount-keyed component (`key = sessionId:status`) so the
  tick interval and baseline reinitialize on pause/resume without refs in render.
- Honest empty states: no habits at all / nothing scheduled today / nothing counts
  today (progress ring shows "–", not a misleading 0%).

## 11. Testing

- Unit (progress): boolean vs summed types, clamping at 100%, the spec's 75%
  example, one-decimal rounding, status transitions, skip precedence, schedule
  awareness of `isHabitCountedOn`, `quantityStep` thresholds.
- Unit (streaks): consecutive counts, missed-day breaks, empty days neutral,
  today-incomplete grace, best-streak survival, weekday-schedule counting,
  skipped-pause behavior, start-date boundary.
- Integration (real temp DB): honest null-percent snapshots, archived exclusion,
  boolean idempotency via unique index, quantity replace/clamp/reject-negative,
  duration accumulation, full timer lifecycle (pause/resume/stop → entry), one
  active timer rule, **timer survives a simulated restart**, skip denominator
  semantics, skip persistence, and service-level overall streaks (skips unblocking
  a perfect day).
- One test expectation was corrected during development (two completed Mondays are
  a streak of 2, not 1 — unscheduled days between don't break).

## 12. Verification

Executed on 2026-11-14:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | ✅ zero errors (both projects) |
| `npm.cmd run lint` | ✅ zero errors (incl. React Compiler purity rules) |
| `npm.cmd run test` | ✅ 75/75 passed (6 files; was 33 before Phase 3) |
| `npm.cmd run build` | ✅ all three bundles emitted (renderer 843 kB JS) |
| Launch `electron.cmd .` | ✅ app starts clean (no console errors) |
| `electron.cmd scripts/db-probe.cjs` | ✅ integrity ok; `schema_migrations` has versions 1 & 2; tables include `habit_entries`, `habit_day_overrides`, `timer_sessions` |

Notes: an earlier lint iteration caught a React-Compiler purity violation (refs
read during render in the first timer hook); it was restructured into the
remount-keyed `TimerDisplay` component. A DB probe initially hit the wrong
userData directory (bare-script Electron uses `Roaming\Electron`); the probe now
targets `%APPDATA%\soloLeving` explicitly.

## 13. Known Issues

- The renderer never polls: if a timer runs while the window is closed (app keeps
  running), a reopened window shows the correct elapsed time on load, but the
  Today page doesn't live-refresh another habit's day (fine for single-window use).
- No per-habit streak display yet (engine + `computeHabitStreaks` exist and are
  tested; the UI shows overall streaks only — per-habit display lands with
  analytics in Phase 5).
- Quantity values accept decimals up to 1,000,000 but the input doesn't enforce
  a per-habit maximum (display clamps progress at 100%).
- No toast notifications; errors surface as a dismissible banner on Today.
- `npm audit` still reports 7 moderate dev-dependency advisories.

## 14. Future Considerations

- Phase 4 (widget): reuse `DaySnapshot` + `shared/domain/*` directly; widget needs
  a second `BrowserWindow` and snapshot push/pull via IPC events.
- Per-habit streaks can be surfaced cheaply once analytics need them
  (`computeHabitStreaks` is ready and tested).
- Timer auto-commit: a timer spanning midnight currently attributes all time to
  the session's start date; an auto-split at midnight could be added later.
- Theme store can migrate from localStorage to the settings table (API exists).

## 15. AI Agent Handoff

- Start from `docs/agent-handoff.md`, then `docs/ipc-contracts.md` (tracking
  section) and `docs/database-schema.md` (migration 0002).
- Progress/streak rules live ONLY in `shared/domain/progress.ts` and
  `streaks.ts`. Never copy a formula into a component, the widget, or a service.
- Tracking business rules (validation, one-timer rule, timer accounting) live in
  `electron/main/services/tracking-service.ts`; the repository is SQL-only.
- To add a tracking mutation: Zod schema in `shared/validation/tracking.ts` →
  service method returning `buildSnapshot(...)` → channel in `ipc-channels.ts` →
  handler in `register-handlers.ts` → preload entry → `contracts/api.ts` →
  update `docs/ipc-contracts.md`.
- Do not import `better-sqlite3` anywhere in `src/` (renderer) — keep it that way.
- `scripts/db-probe.cjs` requires electron (ABI-specific native module): run with
  `node_modules\.bin\electron.cmd scripts\db-probe.cjs`.
