# Modification: Phase 7a — Database Backup & Restore

**Date:** 2026-11-15 · **Phase:** 7a · **Status:** Implemented

## 1. Summary

Full offline backup/restore for the local database, reachable from
Settings → Backup & restore:

- **Export** — native save dialog → better-sqlite3's online backup API
  writes a consistent snapshot of the whole DB even while it is in use.
- **Restore** — native open dialog → the file is validated BEFORE any live
  data is touched (SQLite integrity check + required tables + migration
  versions within the current schema), the renderer confirms with a
  destructive dialog, the live connection is closed, a one-generation
  safety copy is kept (`sololeving.db.pre-restore`), and the backup is
  swapped in atomically (temp file + rename). The service graph is then
  rebuilt, handlers re-registered, and all renderers reload.

## 2. Motivation

Phase 7 item: real durability. Users must be able to move data between
machines and recover from mistakes without touching SQLite manually.

## 3. Previous Behavior

No backup or restore of any kind; the Settings page listed "Database
backup and restore (Phase 7)" as a pending feature.

## 4. New Behavior

As in the summary. Additional details:

- Restore accepts backups with OLDER migration versions (a fresh open
  applies the missing migrations); the result reports how many were
  applied.
- Restore REJECTS backups from NEWER app versions (schema never migrates
  backwards) and non-soloLeving SQLite files, corrupted files, and
  non-SQLite files — each with a specific error message shown inline.
- After restore, every window reloads so all pages re-query the restored
  data. The tray, widget, and reminder service stay functional because
  they read the service graph through live getters.
- Safety copy: one `.pre-restore` file, overwritten on each restore.

## 5. Files Created

- `electron/main/services/backup-service.ts` — `BackupService` (export via
  `db.backup()`, validation, atomic swap, safety copy). Deliberately free
  of Electron APIs for testability.
- `tests/integration/backup-service.test.ts` — 7 integration tests.

## 6. Files Modified

- `electron/main/index.ts` — `ServiceGraph` factory + rebuild/restore
  orchestration; getter-based reminder deps.
- `electron/main/ipc/register-handlers.ts` — idempotent registration
  (every channel unregistered first); backup export/import handlers with
  native dialogs.
- `shared/constants/ipc-channels.ts`, `shared/contracts/api.ts`,
  `electron/preload/index.ts` — `backup:export`, `backup:import`.
- `src/features/settings/SettingsPage.tsx` — Backup & restore card
  (Export/Restore buttons, ConfirmDialog, inline success/error feedback).
- `shared/types/index.ts` — `BackupExportResult`, `BackupImportResult`.

## 7. Architecture

The service graph (db + repositories + services) is now built by a
`buildServiceGraph()` factory and is fully rebuildable at runtime — the
only rebuild trigger today is restore. `registerIpcHandlers` is
idempotent, so it can be called again after a rebuild. Windows/tray/widget
closures capture `graph` (mutable) or getters, never concrete service
instances, with one deliberate exception documented in the code.

## 8. Database Changes

No schema changes. New artifacts in `userData`:

- `<backup>.db` — user-chosen export files.
- `sololeving.db.pre-restore` — safety copy of the live DB before each
  restore (one generation, overwritten).

## 9. IPC Changes

| Channel | Direction | Request | Response |
| --- | --- | --- | --- |
| `backup:export` | invoke | none | `BackupExportResult \| null` (null = dialog canceled) |
| `backup:import` | invoke | none | `BackupImportResult \| null` (null = canceled; rejects with error message) |

`backup:import` assumes the renderer ALREADY confirmed destructiveness
(ConfirmDialog) — the main process validates the file but does not
re-ask.

## 10. UI Changes

Settings gains a "Backup & restore" card: two buttons (disabled while an
operation runs), destructive confirm dialog for restore, and inline
success (green = primary token) / error (danger) messages including the
saved path and size.

## 11. Testing

`tests/integration/backup-service.test.ts`:

1. Export validates as a soloLeving backup at the current schema version.
2. Export leaves the live connection usable.
3. Non-SQLite file → ServiceError "not a readable SQLite database".
4. Missing file → ServiceError.
5. Foreign SQLite DB → ServiceError "not a soloLeving backup".
6. Restore replaces live data with backup contents + reports schema
   version; reopen shows the backup's data.
7. Restore keeps a `.pre-restore` safety copy.

Manual (pending user verification): export → change data → restore →
verify the data matches the backup; restore a corrupted file shows the
inline error.

## 12. Verification

Executed on 2026-11-15:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | ✅ zero errors |
| `npm.cmd run lint` | ✅ zero errors |
| `npm.cmd run test` | ✅ 107/107 passed (11 files) |
| `npm.cmd run build` | ✅ built |

## 13. Known Issues

- Restore reloads renderers; the Settings page success message ("Backup
  restored") may flash briefly before the reload replaces it.
- The `.pre-restore` safety copy is never cleaned up automatically (one
  file, a few MB at most).
- Export does not warn if the destination file already exists beyond the
  OS dialog's own confirm-replace prompt.

## 14. Future Considerations

- Scheduled automatic backups (Settings pending list).
- "Restore safety copy" one-click action for the `.pre-restore` file.
- Include an app version stamp inside backups for better diagnostics.

## 15. AI Agent Handoff

- Never call `registerIpcHandlers` assumptions about single registration —
  it is idempotent by design; keep new channels inside it.
- Anything holding services across a restore must read them through
  `graph.<service>` or getters (see `startReminderService` deps in
  `electron/main/index.ts`), otherwise it will hit a closed DB.
- `BackupService` must stay Electron-free; dialogs belong in the IPC layer.
