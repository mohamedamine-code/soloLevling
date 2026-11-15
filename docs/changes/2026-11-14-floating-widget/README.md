# Modification: Floating Progress Widget

**Date:** 2026-11-14 · **Phase:** 4 · **Status:** Implemented

## 1. Summary

The app's signature feature: a frameless, transparent, always-on-top widget window
that shows today's progress ring, completed/total, current streak, and quick
actions for boolean (check) and quantity (+ step) habits. It renders from the
same `DaySnapshot` source of truth as the dashboard and updates **live** via a
new main→renderer broadcast event — toggling a habit in the widget updates the
dashboard instantly and vice versa. Draggable anywhere; position and visibility
persist in the settings table; toggle lives in Settings.

## 2. Motivation

Phase 4 of the master plan. The widget is the differentiator: progress visible
without opening the main app. The Phase 3 groundwork (`DaySnapshot` returned by
every mutation, single-copy domain engines) made this a thin UI layer.

## 3. Previous Behavior

No widget. The main window was the only renderer surface. There were no
main→renderer push events; renderers only pulled via invoke.

## 4. New Behavior

- On startup the widget shows automatically (persisted default: visible).
- Widget content: progress ring (percent or honest "–"), "x of y done",
  current streak, an active-timer line (live mm:ss via the shared `TimerDisplay`),
  and one compact row per scheduled habit.
- Quick actions from the widget: boolean toggle, quantity `+step`
  (`quantityStep` from the shared engine). Duration habits show progress and,
  when their timer runs, the live elapsed time; timer control stays in the main
  window.
- Broadcast sync: after ANY habit or tracking mutation (from either window), the
  main process pushes the fresh snapshot to all windows via
  `tracking:snapshot-changed`. No polling anywhere.
- Widget header is the drag region (title + open-main + hide buttons are
  no-drag). Position is persisted on each move, rounded and clamped to the
  nearest display's work area.
- Hide (×) hides the window; the Settings toggle (persisted `widget.visible`)
  shows/hides it across restarts. The widget's "open main window" button focuses
  or recreates the main window.
- Closing the main window while the widget is visible keeps the app running
  (widget-only) — the Phase 6 tray will formalize this.

## 5. Files Created

### Main process
- `electron/main/windows/widget-window.ts` — widget window lifecycle
  (create/show/hide/visibility setting, position persistence via `moved`)
- `electron/main/windows/widget-position.ts` — pure geometry helpers
  (`clampPointToRect`, `parseStoredPosition`, `serializePosition`)
- `src/widget/index.html` — widget renderer entry (same CSP as main)
- `src/widget/main.tsx` — transparent root setup + `ThemeProvider` (shared theme)
- `src/widget/WidgetApp.tsx` — widget UI (snapshot subscribe + quick actions)

### Tests
- `tests/unit/widget-position.test.ts` — 9 tests: clamping inside bounds,
  non-zero work-area origins, oversized windows, malformed stored positions,
  serialize/parse round-trip.

## 6. Files Modified

- `shared/constants/ipc-channels.ts` — `TrackingSnapshotChanged`,
  `WidgetSetVisible`, `WidgetHide`, `WidgetOpenMain`
- `shared/contracts/api.ts` — `tracking.onSnapshotChanged(cb)` subscription +
  new `widget` API surface
- `electron/preload/index.ts` — event subscription + widget methods
- `electron/main/ipc/register-handlers.ts` — **all** habit and tracking
  mutations now broadcast snapshots; 3 widget handlers
- `electron/main/index.ts` — widget startup (visibility setting), main-window
  focus/recreate logic for `widget:open-main`
- `electron.vite.config.ts` — renderer build now emits two pages
  (`index.html`, `widget/index.html`)
- `src/stores/tracking-store.ts` — subscribes to broadcast pushes so the main
  window's dashboard updates when the widget mutates tracking
- `src/features/settings/SettingsPage.tsx` — "Floating widget" section with a
  persisted toggle; removed the widget line from "coming later"
- `scripts/db-probe.cjs` — eslint-disable header (CJS diagnostic)
- Docs: `docs/ipc-contracts.md`, `docs/agent-handoff.md`, `docs/architecture.md`,
  `README.md`, `CHANGELOG.md`

## 7. Architecture

**One push event, one source of truth.** `register-handlers.ts` wraps every
mutation (`trackAndBroadcast` for tracking; habit mutations re-broadcast
today's snapshot because schedule changes affect what counts). The broadcast
fans out to every `BrowserWindow`. Both renderers replace their whole snapshot
on receipt (matching the viewed day) — consistent with the Phase 3 rule that
renderers never patch snapshot state locally.

The widget shares:
- `DaySnapshot` + `shared/domain/*` (no formula duplication)
- `CircularProgress` and `TimerDisplay` components
- `global.css` design tokens + `ThemeProvider` (same persisted theme)

Security: same hardening as the main window — `contextIsolation`, `sandbox`,
narrow preload; the widget controls no window geometry except CSS dragging
inside its own surface; position clamping happens in the main process.

## 8. Database Changes

None (Phase 4 adds no migrations). Two settings keys are used via the existing
`settings` table: `widget.visible` (`'1'`/`'0'`, default visible) and
`widget.position` (`'x,y'` integers, written by the main process only).

## 9. IPC Changes

- New **event** `tracking:snapshot-changed` (main → renderer, `webContents.send`):
  payload is a fresh `DaySnapshot`. Subscribed via
  `tracking.onSnapshotChanged(cb)` which returns an unsubscribe function.
- New invoke channels: `widget:set-visible` (boolean, persists + shows/hides),
  `widget:hide` (no persistence), `widget:open-main` (focus or recreate main
  window). Full contracts in `docs/ipc-contracts.md`.

## 10. UI Changes

- New compact widget surface (300×372, rounded, transparent backdrop, subtle
  shadow): header drag region, summary block, optional timer line, habit rows
  with quick actions, honest states for "no habits scheduled today" and load
  failures.
- Settings page: new "Floating widget" card with a working toggle switch and a
  "drag to move" hint.
- The dashboard needs no changes — broadcast subscription was added at the
  store level, so Today updates live even when the widget acts.

## 11. Testing

- Unit: widget position clamping/serialization (9 tests).
- Manual verification covered both windows running together, live sync
  (mutations from either window), widget drag + position persistence, hide +
  Settings toggle restore, and widget-only operation after closing the main
  window.
- The broadcast path is exercised by every existing tracking integration test
  at the service level; window fan-out itself is main-process integration and
  is verified manually (no e2e harness yet — Phase 7).

## 12. Verification

Executed on 2026-11-14:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | ✅ zero errors (both projects) |
| `npm.cmd run lint` | ✅ zero errors |
| `npm.cmd run test` | ✅ 84/84 passed (7 files; was 75 before Phase 4) |
| `npm.cmd run build` | ✅ both pages emitted: `out/renderer/index.html`, `out/renderer/widget/index.html` |
| Launch `electron.cmd .` | ✅ 5 Electron processes (4 base + widget renderer), no console errors; main window + widget visible |

## 13. Known Issues

- Widget rows for quantity/duration show `actual/target` text but quantity
  decrement and duration manual logging remain main-window actions (widget
  stays minimal by design).
- The widget does not re-clamp its saved position across display changes
  (e.g. unplugging a monitor) until the next launch.
- No click-through mode; the widget always captures clicks (intended).
- With the widget visible, closing the main window leaves the app running with
  no taskbar entry (widget is `skipTaskbar`) — recovery is the widget's
  open-main button; the tray (Phase 6) will make this state discoverable.
- Widget transparency requires a compositor (always available on Win10/11 DWM).

## 14. Future Considerations

- Phase 6 (tray): tray menu items "Show/hide widget", "Show soloLeving";
  replace `window-all-closed` quit with tray-based background behavior.
- Multi-monitor: re-clamp the widget on `screen.on('display-removed')`.
- Optional widget scale/compact-rows setting (settings table is ready).
- e2e tests (Phase 7) can drive both windows via the existing typed API.

## 15. AI Agent Handoff

- Widget lifecycle lives in `electron/main/windows/widget-window.ts`; position
  math is pure in `widget-position.ts` (keep it unit-tested).
- Any NEW tracking/habit mutation must be registered through the broadcast
  wrappers in `register-handlers.ts` — otherwise the widget goes stale.
- Renderer-side snapshot replacement must compare `snapshot.date` before
  replacing (the store and widget both do this).
- To add widget UI: `src/widget/` is a separate Vite entry — components can be
  imported from `src/` but anything rendering must keep the transparent,
  drag-region constraints in mind.
- Do not add heavy dependencies to the widget entry; it shares the main bundle's
  CSS and must stay lightweight.
