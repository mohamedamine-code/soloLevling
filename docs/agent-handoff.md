# Current Project Handoff

> **For any AI agent:** read `AGENTS.md` first, then this file. This is the source of
> truth for implementation state. Update it after every meaningful task.

## Project Status

**Phases 0–5 complete.** The app launches with the floating progress widget kept
live-in-sync with the dashboard by a broadcast event. Habit management, full
tracking (boolean/quantity/duration, persisted timers, skips), routines as
reusable habit groups, range analytics (charts, streaks, heatmap), and day-by-day
history browsing all work end to end.

## Completed Features

- Electron + electron-vite + React 19 + TypeScript strict project setup
- Secure main window + narrow typed preload API (`app`, `habits`, `tracking`,
  `widget`, `settings` surfaces)
- Sidebar navigation shell with light/dark/system themes (persisted)
- Reusable UI primitives incl. Dialog, Form controls, ConfirmDialog, EmptyState
- **Phase 2:** SQLite at `%APPDATA%\soloLeving\sololeving.db` (WAL, FKs ON), migration
  runner + `0001_init.sql` (habits, habit_schedules, settings, schema_migrations)
- **Phase 2:** Habit CRUD + archive/restore + reorder via `HabitService` (Zod-validated)
- **Phase 2:** Schedule predicate `isScheduledOn` in `shared/domain/schedule.ts`
- **Phase 2:** Today page lists habits scheduled today, grouped by category
- **Phase 3:** Migration `0002_tracking.sql` — `habit_entries` (partial unique index
  on boolean), `habit_day_overrides` (skip), `timer_sessions`
- **Phase 3:** Progress engine + streak engine as pure shared modules
  (`shared/domain/progress.ts`, `shared/domain/streaks.ts`) — the only copies of
  the formulas
- **Phase 3:** `TrackingService` — snapshots, complete/uncomplete, quantity
  set/increment, duration add, timer start/pause/resume/stop (persisted, restart-
  safe, one active app-wide), skip/unskip, overall streaks
- **Phase 3:** 13 new `tracking:*` IPC channels, all Zod-validated
- **Phase 3:** Interactive Today dashboard — progress ring, summary card, per-type
  controls (stepper, inline edit, manual log, timer buttons), skip/undo, live
  timer readout (remount-keyed `TimerDisplay`, no refs in render)
- **Phase 3:** `scripts/db-probe.cjs` diagnostic (integrity, tables, migrations)
- **Phase 4:** Floating widget — second renderer entry (`src/widget/`), frameless
  transparent always-on-top window, progress ring + streak + quick toggles,
  draggable with persisted position, persisted visibility with a Settings toggle
- **Phase 4:** Live sync — `tracking:snapshot-changed` broadcast to all windows
  after every habit/tracking mutation (no polling); dashboard store and widget
  both subscribe
- **Phase 4:** `scripts/db-probe.cjs` diagnostic, widget-position unit tests
- **Phase 5:** Migration `0003_routines.sql` — `routines`, `routine_habits`
  (ordered members, cascade in both directions)
- **Phase 5:** `RoutineService` + repository — Zod-validated CRUD; members are
  live references to active habits (archived/deleted habits never render)
- **Phase 5:** Routines page — create/edit (habit checklist picker), Start
  dialog with per-type quick actions (boolean toggle, quantity +step, duration
  links to Today), delete-with-confirm
- **Phase 5:** `TrackingService.getRangeAnalytics()` — per-day summary points,
  per-habit range stats with LIFETIME streaks, duration totals, average percent;
  future days never counted as misses; reuses the shared domain functions
- **Phase 5:** Analytics page — 7/30/90-day selector, stat cards (consistency,
  average day, time tracked), Recharts daily completion bars, per-habit
  performance table, GitHub-style consistency heatmap
- **Phase 5:** History page — date picker + prev/next/Today navigation, percent
  ring, per-habit Completed/Partial/Missed/Skipped/Scheduled badges, honest
  empty states for unscheduled and future days
- **Phase 5:** 5 new IPC channels (`tracking:get-range`, `routines:*`); Recharts
  added as the chart library
- 97 passing tests (unit + integration)

## Features In Progress

None — no half-finished work in the tree.

## Pending Work

| Phase | Feature | Notes |
| --- | --- | --- |
| 6 | Notifications + tray | Windows notifications, tray menu, startup setting; tray should take over `window-all-closed` |
| 7 | Tests + installer | e2e, icon assets, electron-builder polish, backup/restore |

## Current Architecture

- Data flow: renderer → preload (`window.soloLeving.habits.*`, `.tracking.*`,
  `.routines.*`) → IPC handlers → Services (Zod validation + rules) →
  repositories (SQL) → SQLite.
- Renderer never touches Node/DB; boundary is `shared/contracts/api.ts`.
- IPC channels enumerated in `shared/constants/ipc-channels.ts`; handlers registered
  only in `electron/main/ipc/register-handlers.ts`.
- Day keys are local `YYYY-MM-DD` via `shared/utils/date.ts` — never UTC.
- Scheduling predicate: `shared/domain/schedule.ts` (single copy, shared by main + renderer).
- Progress + streak formulas: `shared/domain/progress.ts` / `streaks.ts` (single
  copies; dashboard, widget, analytics, and history must consume them, never
  re-implement).
- Range analytics: `TrackingService.getRangeAnalytics()` aggregates a whole
  window in one pass; per-habit streaks are lifetime (schedule start bound), not
  range-bounded.
- Routines store only habit REFERENCES (no duplicate habit data); members
  resolve via `HabitRepository` on read, so archived habits drop out silently.
- Tracking mutations return a fresh `DaySnapshot` — the renderer replaces state
  wholesale instead of patching it.
- Live sync: every habit/tracking mutation in the main process broadcasts a
  `tracking:snapshot-changed` event to all windows; receivers replace their
  snapshot only when `snapshot.date` matches. The ONLY push event so far.
- Renderer entries: `src/index.html` (main app) and `src/widget/index.html`
  (floating widget) — two Vite pages, one preload, one shared preload contract.
- Theme tokens: `:root` (light) and `.dark` overrides in `src/styles/global.css`,
  mapped to Tailwind via `@theme inline`.
- Navigation = typed enum in `src/app/router/views.ts` + zustand store (no router lib).
- Main output is CJS (no `"type": "module"` in package.json) — preload sandbox compatibility.
- electron-vite v6: main/preload live in `electron/`, so `electron.vite.config.ts` sets
  explicit `build.lib.entry` for them; renderer root is `src/` (with `src/index.html`).
- Migration SQL files are inlined at build time (`?raw` imports) — no runtime file lookup.

## Recent Modifications

- [2026-11-14 — Routines, range analytics & history (Phase 5)](../changes/2026-11-14-routines-analytics/README.md)
- [2026-11-14 — Floating progress widget (Phase 4)](../changes/2026-11-14-floating-widget/README.md)
- [2026-11-14 — Tracking engine & interactive Today dashboard (Phase 3)](../changes/2026-11-14-tracking-engine/README.md)
- [2026-11-14 — Database & habit management (Phase 2)](../changes/2026-11-14-database-habits/README.md)
- [2026-11-14 — Application foundation & UI shell (Phase 0–1)](../changes/2026-11-14-foundation/README.md)

## Known Issues

- `npm.ps1` blocked by Windows execution policy on this machine — use `npm.cmd`.
- Electron binary downloads on first execution (postinstall didn't prefetch);
  later runs start instantly.
- `npm audit` shows 7 moderate dev-dependency advisories (tooling chain, not runtime).
- No app icon assets yet (`build/icon.ico` needed before installer builds).
- Sidebar "theme" toggle reads `document.documentElement` class during render for
  `system` mode resolution — works, but may desync one render behind OS changes;
  acceptable until ThemeProvider refactor in a later phase.
- React Compiler lint rules are active: no manual `useMemo` where the compiler
  covers it, no setState in effects (use key-remounted components, e.g.
  `TimerDisplay`, `RoutineFormDialog`, `AnalyticsContent`, `HistoryContent`),
  no refs read during render.
- Analytics does not live-refresh on tracking mutations yet (refreshes on range
  change or page revisit).
- Routine member ordering is selection order; drag-and-drop reorder inside the
  routine form is not implemented.
- Timer running while the app window is closed keeps accruing (persisted), but the
  Today page won't live-refresh until reopened; a single-window UX today.
- With the widget visible, closing the main window leaves the app widget-only
  with no taskbar entry; the widget's open-main button recovers it. Tray
  (Phase 6) will make this state discoverable.
- `npm audit` now also reports advisories in the Recharts dependency tree
  (transitive, dev/tooling surface).

## Important Decisions

- [ADR-001 — Electron architecture & process boundaries](decisions/ADR-001-electron-architecture.md)
- [ADR-002 — SQLite as the only persistence layer](decisions/ADR-002-sqlite-storage.md)

## How to Run

```powershell
npm install
npm run dev
```

## How to Test

```powershell
npm.cmd run typecheck   # ✅ verified 2026-11-14 (Phase 5)
npm.cmd run test        # ✅ 97/97 tests pass (verified 2026-11-14, Phase 5)
npm.cmd run lint        # ✅ verified 2026-11-14 (Phase 5)
npm.cmd run build       # ✅ verified 2026-11-14 (Phase 5)
node_modules\.bin\electron.cmd scripts\db-probe.cjs   # live-DB diagnostic
```

## Recommended Next Task

**Phase 6 — Notifications + tray.** Concretely:

1. Tray icon + menu (open main window, toggle widget, quit) — take over the
   `window-all-closed` behavior so a tray resident app keeps the widget alive.
2. Daily reminder notifications (Windows toasts) with a Settings toggle +
   reminder time; honest behavior when notifications are unavailable.
3. Optional: routine start-time reminders, reusing the routine data shape.
4. Keep every new IPC channel documented in `docs/ipc-contracts.md` and
   Zod-validated in the main process.
