# Testing Guide

## Stack

- **Vitest** for unit and integration tests (`tests/unit/`, `tests/integration/`).
- Config: `vitest.config.ts` (aliases `@` → `src`, `@shared` → `shared`).
- React Testing Library + jsdom are installed for future component tests.

## Commands

```powershell
npm run test       # run once (CI mode)
npm run test:watch # watch mode
npm run typecheck  # strict TS across node + web projects
npm run lint
npm run build      # verifies the production bundle
```

## What is tested today

| Suite | File | Covers |
| --- | --- | --- |
| Date utils | `tests/unit/date.test.ts` | local `YYYY-MM-DD` keys (incl. late-night UTC trap), greeting, minute formatting |

## Widget manual test checklist (Phase 4 — run on a real desktop)

1. Always-on-top above other windows and fullscreen apps.
2. Drag to several positions → restart → position restored.
3. Move between monitors → position clamped to visible work area.
4. Disconnect second monitor → widget reappears on the primary monitor.
5. Quick complete + quick quantity update reflect instantly in the main window (and vice versa).
6. Theme switch in the main window updates the widget.
7. DPI scaling 100% / 125% / 150%.

## Database integration tests (Phase 2+)

Run the real SQLite service against a temp directory: migrations apply cleanly,
constraints reject invalid data, transactions roll back atomically, foreign keys fire.

## Before declaring any phase complete

- `npm run typecheck` — zero errors
- `npm run test` — all suites pass
- `npm run lint` — no errors
- `npm run build` — bundle succeeds
- App actually launches (`npm run dev`) for UI-facing changes
- Record the **real** results in the change README's Verification section
