# soloLeving

**soloLeving** is a local-first Windows desktop application for personal habit management, daily activity tracking, productivity monitoring, and long-term consistency analysis.

Its signature feature is a **compact floating desktop widget** that shows today's progress in real time — without opening the main application.

> **Status:** Phases 0–5 done. The application launches with a complete navigable UI
> shell, light/dark themes, Electron security hardening, **SQLite persistence, full
> habit management** (create/edit/archive/restore/delete/search/filter/reorder with
> scheduling), **daily tracking** (boolean check-offs, quantity steppers, live
> persisted timers, skip days, progress ring, schedule-aware streaks), **routines**
> (reusable habit groups with a start-the-routine checklist), **range analytics**
> (completion charts, per-habit streaks, consistency heatmap), **day-by-day
> history**, **and the signature floating widget**: a compact always-on-top desktop
> companion kept live-in-sync with the dashboard. Notifications and the system tray
> are not implemented yet — see [docs/agent-handoff.md](docs/agent-handoff.md) for
> the exact state.

## Main features

- **Floating Widget** — compact always-on-top progress ring, streak, and quick
  toggles; draggable, persisted position, live sync with the dashboard. *(done)*
- **Today Dashboard** — real-time progress ring, per-habit tracking controls
  (check, ± stepper, timer, manual log), skip/undo, streak badges. *(done)*
- **Habit Management** — create, edit, archive, restore, delete, search, filter, and
  reorder habits with daily/weekday schedules and start/end dates. *(done)*
- **Persistent storage** — SQLite in the main process, migrations, constraints. *(done)*
- **Three tracking types** — boolean, quantity, duration, with persisted
  restart-safe timers and skip days. *(done)*
- **Floating Widget** — always-on-top frameless desktop widget with live progress sync. *(done)*
- **Routines** — reusable ordered habit groups; check off a whole routine from
  one dialog. *(done)*
- **Analytics** — 7/30/90-day completion chart, consistency heatmap, per-habit
  performance with lifetime streaks, time totals. *(done)*
- **History** — day-by-day browsing of completed, missed, and skipped habits. *(done)*
- **Local data** — SQLite storage, backup/restore, no cloud, no telemetry. *(backup in Phase 7)*

## Technology stack

| Layer | Technology |
| --- | --- |
| Desktop | Electron, electron-vite, electron-builder |
| Frontend | React 19, TypeScript (strict), Vite |
| Styling | Tailwind CSS v4, custom design tokens |
| State | Zustand |
| Icons | Lucide React |
| Tests | Vitest |
| Database (later phases) | SQLite via better-sqlite3 in the main process |

## Prerequisites

- Windows 10 or 11
- Node.js 20+ (developed on Node 24)
- npm 10+

## Installation

```powershell
npm install
```

## Development commands

```powershell
npm run dev        # Start the app with hot reload
npm run build      # Production build (out/)
npm run preview    # Run the production build
npm run typecheck  # Strict TypeScript check (node + web projects)
npm run test       # Run all unit tests (Vitest)
npm run lint       # ESLint
npm run format     # Prettier
```

> On systems where PowerShell blocks `npm.ps1` (execution policy), use `npm.cmd` instead of `npm`.

## Build (Windows installer)

`electron-builder.yml` is configured for a Windows NSIS installer. Icon assets and the
production build pipeline are scheduled for Phase 7; until then `npm run build` produces
the bundled application output without an installer.

## Database location

SQLite lives in Electron's `app.getPath('userData')` directory
(`%APPDATA%\soloLeving\sololeving.db` on Windows) — never inside the installation
folder. Schema and migrations are documented in
[docs/database-schema.md](docs/database-schema.md).

## Architecture overview

```
┌─────────────────────────────────────────────┐
│ Electron main process                       │
│  windows/ (main window, later widget)       │
│  ipc/      (typed handlers)                 │
│  services (later: DB, progress engine)      │
└──────────────┬──────────────────────────────┘
               │ typed IPC via narrow preload API
┌──────────────┴──────────────────────────────┐
│ Preload (contextBridge, sandboxed)          │
└──────────────┬──────────────────────────────┘
               │ window.soloLeving.*
┌──────────────┴──────────────────────────────┐
│ React renderer (src/)                       │
│  app/ components/ features/ stores/ utils/  │
└─────────────────────────────────────────────┘
```

Key rule: **the renderer never touches the database or Node APIs**. All persistence
and domain logic runs in the main process behind typed IPC contracts.

## Documentation

- [AGENTS.md](AGENTS.md) — start here if you are an AI coding agent
- [docs/agent-handoff.md](docs/agent-handoff.md) — current implementation state
- [docs/architecture.md](docs/architecture.md)
- [docs/product-specification.md](docs/product-specification.md)
- [docs/ui-guidelines.md](docs/ui-guidelines.md)
- [docs/ipc-contracts.md](docs/ipc-contracts.md)
- [docs/database-schema.md](docs/database-schema.md)
- [docs/testing-guide.md](docs/testing-guide.md)
- [docs/decisions/](docs/decisions/) — architecture decision records
- [docs/changes/](docs/changes/) — one README per meaningful modification
- [CHANGELOG.md](CHANGELOG.md)
