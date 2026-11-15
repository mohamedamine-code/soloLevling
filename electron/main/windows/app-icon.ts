import { app } from 'electron'
import { join } from 'node:path'

/**
 * Resolves the application icon used by the tray and windows.
 *
 * - Dev: `build/icon.ico` inside the project root (`app.getAppPath()`).
 * - Packaged: `icon.ico` is shipped via electron-builder `extraResources`
 *   and lives next to the executable in `process.resourcesPath`.
 */
export function getAppIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath ?? '', 'icon.ico')
  }
  return join(app.getAppPath(), 'build', 'icon.ico')
}
