# ADR-001 — Electron Architecture & Process Boundaries

**Date:** 2026-11-14 · **Status:** Accepted

## Context

soloLeving needs native desktop capabilities (always-on-top widget window, tray,
notifications, SQLite) plus a rich, themeable UI. The rendering layer must never gain
direct access to Node APIs or the database.

## Decision

- Electron with a **main process owning all native + data concerns**, a **sandboxed
  preload exposing a narrow typed API** (`shared/contracts/api.ts`), and a **pure
  renderer** with no Node access.
- Build tooling: **electron-vite** (main/preload/renderer pipelines, HMR, aliasing).
- No `"type": "module"` in package.json: main and preload output stay CJS, which is
  the safest mode for sandboxed preloads and Electron's CJS loader expectations.
- Renderer navigation is a typed view enum + zustand store instead of a URL router.

## Alternatives considered

- **Tauri / WPF / Qt** — rejected: React + TypeScript web stack and the existing skill
  set matter; Tauri's WebView2 brings rendering inconsistency risk; WPF/Qt don't fit
  the web component ecosystem.
- **URL router (react-router)** in renderer — rejected: unnecessary for a fixed six-view
  desktop shell; a typed enum gives exhaustive-switch safety.
- **Wide preload API / nodeIntegration** — rejected outright (security).

## Consequences

- (+) Clear ownership: persistence and domain services can't leak into UI code.
- (+) Widget (Phase 4) can reuse the same main-process services via its own window.
- (−) Every feature requires IPC plumbing; mitigated by centralized channel constants,
  a single handler registration file, and typed contracts.
- (−) CJS output means ESM-only packages need care in main/preload (externalize or bundle).
