# Modification: System Tray & Daily Notifications (Phase 6)

**Date:** 2026-11-15 · **Phase:** 6 · **Status:** Implemented

## 1. Summary

Makes soloLeving a proper background Windows resident and adds its first
notifications:

- **System tray** — brand icon in the notification area with a menu
  (Open soloLeving / Show–Hide floating widget / Quit soloLeving). The tray
  takes over `window-all-closed`: closing every window keeps the app running
  in the tray instead of exiting.
- **Close-to-tray** — an opt-in Settings behavior: when enabled, closing the
  main window hides it instead of destroying it (default OFF, preserving the
  previous behavior).
- **Daily reminder** — at most one Windows toast per day at a configured time,
  fired only when scheduled, non-skipped habits are still open. Toggle + time
  + test button live in Settings.
- **App icon** — `scripts/generate-icons.mjs` draws the brand icon (green
  rounded square + white checkmark) with zero dependencies and writes
  `build/icon.ico` (16–256) and `build/icon.png`; used by the tray, window
  title bars/taskbar, and (later) the installer.

## 2. Motivation

Phase 6 of the master plan. Two drivers: (a) the Phase 4 widget-only mode left
the app running with no taskbar entry and no discoverable recovery — the tray
formalizes that state; (b) the product spec requires daily reminders that
respect schedules and avoid spam.

## 3. Previous Behavior

- `window-all-closed` quit the app unconditionally.
- Closing the main window destroyed it; with the widget visible the app
  continued widget-only with no taskbar entry (recovery only via the widget's
  open-main button).
- No tray, no notifications, no app icon (Electron default icon everywhere).

## 4. New Behavior

- Tray icon appears at startup. Left-click opens/focuses the main window.
  Context menu: **Open soloLeving**, **Show/Hide floating widget** (label
  reflects current state, rebuilt after each toggle), **Quit soloLeving**.
- Quit performs the real exit: sets a `quitting` flag, calls `app.quit()`;
  `before-quit` re-sets the flag so close-to-tray handlers let the windows
  close. The tray is destroyed on `will-quit`.
- `window-all-closed` now quits only when `quitting` is true; otherwise the
  app stays resident (tray is the discoverable surface).
- Close-to-tray (`window.closeToTray` settings key, default OFF): main-window
  `close` events are intercepted → `preventDefault()` + `hide()`. Destroying
  behavior is otherwise unchanged.
- Daily reminder scheduler (main process, 60s interval, first check after
  10s): fires once per day (`notifications.lastFired` key) when
  `notifications.enabled` === '1', current local time ≥ `notifications.time`
  (default 09:00, `HH:MM` validated), and today's snapshot has ≥ 1
  scheduled, non-skipped habit that is not completed. Body reports
  "N habits still open — X of Y done". Clicking the toast opens the main
  window. If nothing is scheduled at check time the day is NOT marked as
  fired, so a habit added later still gets its reminder.
- Honest fallback: if `Notification.isSupported()` is false the scheduler
  logs and disables itself; the Settings test button surfaces a visible
  error message instead of pretending.
- Settings page gains "Notifications" (toggle, time picker, Send test with
  inline error feedback) and "Behavior" (close-to-tray toggle) cards.

## 5. Files Created

- `electron/main/tray/tray.ts` — tray creation, context menu, refresh,
  destroy; `TrayCallbacks` interface (openMainWindow / toggleWidget / quit).
- `electron/main/notifications/reminder-service.ts` — scheduler,
  `startReminderService(deps)`, `sendTestNotification()`.
- `electron/main/windows/app-icon.ts` — `getAppIconPath()` (dev: `build/icon.ico`
  under `app.getAppPath()`; packaged: `process.resourcesPath/icon.ico`).
- `scripts/generate-icons.mjs` — dependency-free icon generator (RGBA raster +
  supersampled AA → PNG via `node:zlib` → PNG-compressed ICO entries).
- `build/icon.ico`, `build/icon.png` — generated assets (committed).

## 6. Files Modified

- `electron/main/index.ts` — `quitting` flag, `before-quit`/`will-quit`,
  close-to-tray options object threaded into every `createMainWindow` call,
  `window-all-closed` takeover, tray creation, reminder startup. The
  `will-navigate` guard no longer calls `shell.openExternal` (blocked outright
  until validated external opening lands with the hygiene fixes).
- `electron/main/windows/main-window.ts` — `icon` option;
  `MainWindowOptions.interceptClose()` close handler; new exported
  `focusOrCreateMainWindow()` (extracted from the IPC widget dep so the tray
  and widget share one implementation).
- `electron/main/ipc/register-handlers.ts` — new `notifications:test` handler.
- `shared/constants/ipc-channels.ts` — `NotificationsTest: 'notifications:test'`.
- `shared/contracts/api.ts` — new `notifications.test()` surface.
- `electron/preload/index.ts` — `notifications.test` mapping.
- `src/features/settings/SettingsPage.tsx` — Notifications + Behavior cards;
  reusable `useSettingFlag(key)` and `useReminderTime()` hooks; removed the
  Phase 6 items from "coming later".
- `electron-builder.yml` — `extraResources` ships `build/icon.ico` next to
  the executable for packaged runs.
- `eslint.config.mjs` — node globals for `scripts/**/*.mjs`.
- Docs: `docs/ipc-contracts.md`, `docs/architecture.md`, `docs/agent-handoff.md`,
  `README.md`, `CHANGELOG.md`.

## 7. Architecture

The tray is a main-process singleton in its own module (`tray/tray.ts`) that
depends only on callbacks — it does not import services. Widget toggling goes
through the existing `setWidgetVisible(!isWidgetVisible(), settings)` so the
persisted `widget.visible` key and the Settings toggle stay in agreement;
`refreshTrayMenu()` rebuilds the label after each change.

The reminder service is a self-contained main-process module depending on
`SettingsRepository` + `TrackingService` (read-only snapshot use) and an
`openMainWindow` callback. It reuses `getDaySnapshot()` — no progress logic
duplicated. One `setInterval` for the whole app; per-day idempotence is a
settings-table key, so restarts cannot double-notify.

Window lifecycle: `quitting` is the single coordination flag. Tray Quit sets
it before `app.quit()`; `before-quit` sets it for OS-initiated quits;
close-to-tray interception checks it so Quit always truly exits.

## 8. Database Changes

No migrations. New settings-table keys (plain key/value, main-process owned):

| Key | Values | Default | Writer |
| --- | --- | --- | --- |
| `window.closeToTray` | `'1'` / `'0'` | unset (= OFF) | Settings page via `settings:set` |
| `notifications.enabled` | `'1'` / `'0'` | unset (= OFF) | Settings page via `settings:set` |
| `notifications.time` | `'HH:MM'` (24h local) | `'09:00'` | Settings page via `settings:set` |
| `notifications.lastFired` | local `YYYY-MM-DD` | — | main process only |

## 9. IPC Changes

- New invoke channel `notifications:test` → `notifications.test()`: shows a
  test toast immediately; rejects with
  "Notifications are not supported on this system" when unsupported. No
  input to validate. Full contract in `docs/ipc-contracts.md`.
- Reminder preferences are intentionally NOT new channels: they persist
  through the existing generic `settings:get`/`settings:set`, and the main
  process reads them directly from the settings table (renderer and main
  agree via the table, not via pushed state).
- No new push events; `tracking:snapshot-changed` remains the only one.

## 10. UI Changes

- Settings → "Notifications": reminder toggle, `<input type="time">`
  (disabled while reminders are off), "Send test" button with inline danger
  text on failure.
- Settings → "Behavior": close-to-tray toggle with an explanatory hint.
- Taskbar/window icon is now the brand icon instead of Electron's default.

## 11. Testing

- The full gate passes (see Verification). Tray/notifications are
  main-process integrations without an e2e harness; verified manually:
  tray appears and opens the window, widget toggle flips label + visibility,
  Quit exits fully, close-to-tray (enabled) hides instead of closing and
  Quit still exits, test toast shows, unsupported-notification error path
  renders the inline message.
- Reminder firing logic branches (enabled flag, time reached, lastFired,
  open habits) follow the same shape as `TrackingService` rules and are
  candidates for extraction + unit tests if they grow.

## 12. Verification

Executed on 2026-11-15:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | ✅ zero errors |
| `npm.cmd run lint` | ✅ zero errors |
| `npm.cmd run test` | ✅ 97/97 passed |
| `npm.cmd run build` | ✅ built in ~1.4s |
| `node scripts/generate-icons.mjs` | ✅ writes `build/icon.ico` (5,036 B) + `build/icon.png` (2,117 B) |
| Launch `electron.cmd .` | ✅ tray icon visible with working menu; main window + widget up; user-confirmed on desktop |

## 13. Known Issues

- The tray menu is not checked-state (radio/checkbox) for the widget item —
  the label flips instead; acceptable and simpler.
- Reminders do not respect per-habit reminder times (product spec's
  "optional reminders" per habit is a later refinement; today is a single
  app-level daily reminder).
- Windows startup (login item) is NOT implemented yet — it was listed as
  Phase 6 optional and remains open.
- If the tray icon file is missing/corrupt the app runs tray-less; then
  `window-all-closed` still keeps the app alive with no UI — recovery is
  restarting the app. (Icon is committed, so this is a defensive path only.)

## 14. Future Considerations

- Windows startup via `app.setLoginItemSettings` + a Settings toggle.
- Per-habit reminder times reusing habit data; routine start reminders.
- Tray icon states (e.g. all-done checkmark) driven by the snapshot broadcast.
- e2e coverage for tray/notification flows (Phase 7 harness).

## 15. AI Agent Handoff

- `tray/tray.ts` holds module state (`tray`, `callbacks`); always create it
  once in `index.ts` and use `refreshTrayMenu()` after widget visibility
  changes from any other path.
- Any new window-destroying behavior must check the `quitting` flag pattern
  in `index.ts` — otherwise Quit breaks.
- Reminder keys are read defensively (missing/invalid → no fire); do not
  trust `notifications.time` format without the `TIME_PATTERN` check.
- `notifications.lastFired` is main-process-only; never expose it in UI.
- The `will-navigate` guard currently blocks all non-internal navigation
  without opening anything; validated external opening is a pending hygiene
  task (AGENTS.md rule).
