# Modification: Phase 7b — Windows Installer

**Date:** 2026-11-15 · **Phase:** 7b · **Status:** Implemented

## 1. Summary

`npm run dist` now produces a real Windows NSIS installer:
`dist/sololeving-<version>-setup.exe`. The packaged executable was
smoke-tested (launch → running → stop) with the native module intact.

## 2. Motivation

Phase 7 deliverable: a distributable installer, not just a dev tree.

## 3. Previous Behavior

`electron-builder.yml` existed but `electron-builder` was not installed,
the `win` section had no icon, and no `dist` script existed.

## 4. New Behavior

- `npm run dist` = `electron-vite build` + `electron-builder --win`.
- `@electron/rebuild` rebuilds `better-sqlite3` for the Electron ABI
  automatically during packaging (uses the VS Build Tools installed
  earlier on this machine).
- NSIS: assisted installer (`oneClick: false`), per-user install,
  changeable install directory, custom uninstall display name and
  shortcut name (`soloLeving`), app icon from `build/icon.ico`.

## 5. Files Created

None (configuration-only change).

## 6. Files Modified

- `package.json` — `electron-builder` devDependency, `dist` script.
- `electron-builder.yml` — `win.icon`, `uninstallDisplayName`,
  `shortcutName`.
- `build/README.md`, `README.md` — installer instructions.

## 7. Architecture

No changes. Packaging only.

## 8. Database Changes

None. The packaged app uses the same `userData` location
(`%APPDATA%\soloLeving`), so installed and dev builds share the database.

## 9. IPC Changes

None.

## 10. UI Changes

None in-app; the installer shows the app icon and proper product name.

## 11. Testing

- `npm run dist` completes and emits `dist/sololeving-0.1.0-setup.exe`
  (131 MB) + blockmap.
- Smoke test: `dist\win-unpacked\soloLeving.exe` launched and stayed
  alive (no native-module ABI crash), then was stopped cleanly.

## 12. Verification

Executed on 2026-11-15:

| Command | Result |
| --- | --- |
| `npm.cmd run dist` | ✅ installer built |
| packaged exe smoke test | ✅ running, stopped |
| `git check-ignore dist` | ✅ dist/ is gitignored |

## 13. Known Issues

- No code signing (no certificate configured) — Windows SmartScreen will
  warn on first run. Acceptable for personal use; do not ship publicly
  unsigned.
- Dev and installed builds share the same database (documented above).

## 14. Future Considerations

- Code-signing certificate + `signtool` configuration.
- `latest.yml` auto-update metadata if updates are ever added.

## 15. AI Agent Handoff

- Always build the installer with `npm.cmd run dist` (npm.ps1 is blocked
  on this machine).
- `@electron/rebuild` output is cached under `node_modules` — a fresh
  `npm install` requires rebuilding (VS Build Tools present).
