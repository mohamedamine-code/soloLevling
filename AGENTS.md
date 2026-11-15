# AGENTS.md — Guide for AI Coding Agents

Welcome to soloLeving. This file is your entry point. Read it fully before writing code.

## Project mission

A premium, local-first Windows desktop app (Electron + React + TypeScript) for habit
management with a live floating progress widget. Quality bar: production-grade, fully
offline, beautiful, testable, and understandable by a fresh agent with zero prior context.

## Before you touch anything

1. Read `README.md`
2. Read `docs/agent-handoff.md` — the single source of truth for current state
3. Read `docs/architecture.md`
4. Read the change README for the area you're modifying: `docs/changes/<date>-<name>/README.md`
5. Read `CHANGELOG.md`

**Never start a feature without checking whether it already exists.** Inspect `src/`,
`electron/`, and `shared/` first. Repair defective implementations; don't duplicate them.

## Important directories

```
electron/main/     Main process: windows, ipc, (later) db, services, tray, widget
electron/preload/  Narrow contextBridge API (typed by shared/contracts/api.ts)
src/               React renderer (app/, components/, features/, stores/, utils/, styles/)
shared/            Types, constants, IPC contracts — imported by main AND renderer
tests/             Vitest suites (unit/, integration/, e2e/)
docs/              Architecture, specs, ADRs, change READMEs
```

## Development conventions

- TypeScript strict mode. `any` requires a documented justification comment.
- Domain logic (progress, streaks, scheduling) lives in dedicated services, never in
  React components or the widget. Never duplicate progress formulas.
- All date keys are local `YYYY-MM-DD` (see `src/utils/date.ts`). Never use
  `toISOString()` for day keys — UTC shifts corrupt daily logs.
- Validate all IPC inputs with Zod (once Phase 2 introduces it) in the main process.
- No dead buttons, no fake features, no placeholder data presented as real.
- Components stay small; pages are compositions of feature components.

## Commands

```powershell
npm run dev        # dev with hot reload
npm run build      # production bundle
npm run typecheck  # both TS projects — must pass
npm run test       # vitest — must pass
npm run lint       # eslint
```

## Database rules (Phase 2+)

- SQLite via better-sqlite3, **main process only**. Renderer never imports it.
- Versioned SQL migrations in `database/migrations/`; track in `schema_migrations`.
- Foreign keys ON, transactions for multi-step writes.
- Store the DB file in `app.getPath('userData')`, not the install dir.
- Document every schema change in the change README + `docs/database-schema.md`.

## Electron security rules

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Preload exposes only the narrow typed API in `shared/contracts/api.ts`.
- Every new IPC channel needs: typed name in `shared/constants/ipc-channels.ts`,
  a handler in `electron/main/ipc/`, input validation, and docs in
  `docs/ipc-contracts.md`.
- No remote content, no arbitrary `shell.openExternal` of renderer-supplied URLs
  without validation.

## UI rules

- Design tokens live in `src/styles/global.css` (`:root` light / `.dark` dark).
  Never hardcode hex colors in components.
- Lucide icons only, `strokeWidth={1.75}`, consistent sizing.
- Animations: subtle, must respect `prefers-reduced-motion` (handled globally in CSS).
- Honest empty states for every unfinished feature. See `docs/ui-guidelines.md`.

## Documentation requirements (mandatory)

For every meaningful change:

1. Create `docs/changes/<YYYY-MM-DD>-<slug>/README.md` using the 15-section template
   (copy from any existing change README).
2. Update `CHANGELOG.md` with a link to it.
3. Update `docs/agent-handoff.md` (status, recent modifications, next task).
4. Update related docs (architecture / ipc / database / ui) if they were affected.
5. **Never claim tests passed unless you actually ran them.** Record real commands
   and real outcomes in the change README's Verification section.

## Adding a new feature

Plan → check dependencies → implement in small modules → typecheck → test →
run the app if UI-facing → write the change README → update handoff + changelog.

## Changing existing behavior

Understand current usage first (grep for consumers), preserve external contracts or
migrate them deliberately, and document the previous vs. new behavior in the change README.

## Architectural decisions

Significant decisions get an ADR in `docs/decisions/` (context, decision,
alternatives, reasoning, consequences). Do not silently reverse an ADR — write a
superseding one.
