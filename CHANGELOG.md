# Changelog

All notable changes. Each entry links to its modification README.

## 2026-11-15 (Phase 6.x hygiene)

### Fixed
- Analytics and History now live-refresh from `tracking:snapshot-changed`
  when tracking mutations affect their data (Today + widget already did).
- Midnight rollover: shared `useTodayKey()` hook re-evaluates the local date
  every 30s — long-running dashboard/widget sessions roll to the new day.
- `shell.openExternal` is gated by `isSafeExternalUrl()` (http/https only)
  in both `will-navigate` and the window-open handler; 3 new unit tests.

Documentation:
- [Hygiene fixes](docs/changes/2026-11-15-hygiene-fixes/README.md)

---

## 2026-11-15 (Phase 6)

### Added
- System tray: brand icon in the notification area; menu = Open soloLeving,
  Show/Hide floating widget (state-aware label), Quit soloLeving (real exit
  via a `quitting` flag). Left-click opens the main window.
- Tray takes over `window-all-closed`: closing every window keeps the app
  resident in the tray instead of exiting.
- Close-to-tray behavior (Settings toggle, default off) — closing the main
  window hides it when enabled.
- Daily habit reminder: at most one Windows toast per day at a configurable
  time (default 09:00), fired only when scheduled non-skipped habits are
  still open; click opens the app; per-day idempotence via the settings
  table. Honest fallback + "Send test" button with inline error feedback.
- App icons: `scripts/generate-icons.mjs` (dependency-free PNG/ICO encoder)
  generates `build/icon.ico` + `build/icon.png`; used by the tray, windows,
  and shipped via `extraResources` for packaged builds.
- 1 new IPC channel (`notifications:test`), documented in
  `docs/ipc-contracts.md`.

Documentation:
- [System tray & daily notifications](docs/changes/2026-11-15-tray-notifications/README.md)

---

## 2026-11-14 (Phase 5)

### Added
- Routines: reusable, ordered groups of existing habits — create, edit, delete
  (members are live references; archived habits never render). Migration 0003
  adds `routines` + `routine_habits` with cascading FKs.
- "Start routine" dialog: check off each member for today from one place;
  boolean toggle, quantity +step, duration links to Today; syncs the widget and
  dashboard via the existing snapshot broadcast.
- Range analytics over real data: 7/30/90-day selector, consistency/average-day/
  time-tracked stat cards, daily completion bar chart (Recharts 3.10.1),
  per-habit performance table with lifetime current/best streaks, and a
  GitHub-style consistency heatmap. Unscheduled days are never counted as
  failures; future days produce no chart filler.
- History browser: pick or step through past days with a percent ring,
  completed/scheduled counts, streak-as-of-that-day, and per-habit
  Completed/Partial/Missed/Skipped/Scheduled badges.
- 5 new IPC channels (`tracking:get-range`, `routines:list|create|update|delete`),
  all Zod-validated in the main process; sidebar pending flags removed.

Documentation:
- [Routines, range analytics & history](docs/changes/2026-11-14-routines-analytics/README.md)

---

## 2026-11-14 (Phase 4)

### Added
- Floating progress widget: frameless, transparent, always-on-top companion
  window (own renderer entry) showing the progress ring, completed/total,
  current streak, an active-timer line, and compact habit rows.
- Quick actions from the widget: boolean toggle and quantity +step.
- Live two-window sync: `tracking:snapshot-changed` broadcast to all windows
  after every habit/tracking mutation — no polling anywhere.
- Widget dragging with persisted position (clamped to the work area) and
  persisted visibility with a Settings toggle; "open main window" button
  recreates the closed main window.
- Widget-position unit tests; renderer build now emits two pages.

Documentation:
- [Floating progress widget](docs/changes/2026-11-14-floating-widget/README.md)

---

## 2026-11-14 (Phase 3)

### Added
- Daily tracking for all three habit types: boolean check-offs, quantity with ±
  steppers and inline editing, duration with manual minute logging.
- Persisted timer sessions (start/pause/resume/stop) that survive app restarts —
  elapsed time recomputed from `started_at`; exactly one active timer app-wide.
- Skip overrides per habit/day — removes the habit from the progress denominator
  and pauses streaks without touching tracking entries.
- Shared progress engine (`shared/domain/progress.ts`) and schedule-aware streak
  engine (`shared/domain/streaks.ts`) — single copies of the formulas, consumed by
  the main process and reusable by the future widget.
- `DaySnapshot` returned by every tracking mutation: states, day progress,
  overall streak, active timer.
- Interactive Today dashboard: progress ring with summary card, per-type tracking
  controls, skip/undo, live timer readout, honest empty states.
- Migration `0002_tracking.sql`: `habit_entries` (partial unique index on
  boolean), `habit_day_overrides`, `timer_sessions`.
- 13 Zod-validated `tracking:*` IPC channels; `scripts/db-probe.cjs` diagnostic.
- Tests: progress + streak engines unit tests, tracking-service integration tests
  over a real temp DB (timer restart survival, skip semantics, one-timer rule).

Documentation:
- [Tracking engine & interactive Today dashboard](docs/changes/2026-11-14-tracking-engine/README.md)

---

## 2026-11-14 (Phase 2)

### Added
- SQLite persistence layer (better-sqlite3, main process only) with transactional
  migrations, CHECK constraints, and foreign keys.
- Habit management: create, edit, archive, restore, delete with confirmation,
  search, category filter, and reordering — over 9 new typed IPC channels with
  Zod validation in the main process.
- Habit scheduling (daily / selected weekdays, start/end dates) with a shared
  `isScheduledOn` domain predicate.
- Settings key/value store and API.
- Today dashboard now lists real scheduled habits grouped by category.
- Integration test suite for the database layer; schedule unit tests.

Documentation:
- [Database & habit management](docs/changes/2026-11-14-database-habits/README.md)

### Changed
- Today page and My Habits page replaced pending empty states with real data flows
  (honest empty states retained where tracking is still missing).

---

## 2026-11-14 (Phase 0–1)

### Added
- Electron application foundation: main process, secure main window, typed preload API.
- React 19 + TypeScript strict renderer with Tailwind CSS v4 design tokens.
- Sidebar navigation shell (Today, My Habits, Routines, Analytics, History, Settings)
  with honest empty states for pending features.
- Light, dark, and system themes with persistence.
- Settings page with working theme selector and live app-info IPC readout.
- Local-date utilities with unit tests; Vitest, ESLint, Prettier wired up.
- Documentation foundation: README, AGENTS.md, architecture/product/IPC/database/UI/
  testing docs, ADR-001, ADR-002, agent handoff.

Documentation:
- [Application foundation & UI shell](docs/changes/2026-11-14-foundation/README.md)
