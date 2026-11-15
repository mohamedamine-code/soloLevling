import { Menu, Tray } from 'electron'
import { getAppIconPath } from '../windows/app-icon'
import { isWidgetVisible } from '../windows/widget-window'

/**
 * System tray. Makes the app a proper background resident:
 *
 * - "Open soloLeving" focuses (or recreates) the main window.
 * - "Show / Hide floating widget" toggles the widget (persisted).
 * - "Quit soloLeving" performs the real exit (sets the quitting flag first,
 *   so close-to-tray window handlers let the windows actually close).
 *
 * The tray takes over `window-all-closed`: closing every window no longer
 * quits the app — it stays resident here until the user quits explicitly.
 */

export interface TrayCallbacks {
  /** Focuses the main window, recreating it if it was closed. */
  openMainWindow: () => void
  /** Shows the widget when hidden, hides it when visible (persists). */
  toggleWidget: () => void
  /** Performs the real application exit. */
  quit: () => void
}

let tray: Tray | null = null
let callbacks: TrayCallbacks | null = null

export function createTray(trayCallbacks: TrayCallbacks): Tray | null {
  callbacks = trayCallbacks
  try {
    // Windows Tray accepts .ico directly; sizes are inside the file.
    tray = new Tray(getAppIconPath())
  } catch (error) {
    // A missing/unreadable icon must not crash the app; run without a tray.
    console.error('[tray] could not create tray icon:', error)
    return null
  }

  tray.setToolTip('soloLeving')
  tray.on('click', () => callbacks?.openMainWindow())
  rebuildMenu()
  return tray
}

/** Rebuilds the context menu (call after the widget visibility changes). */
export function refreshTrayMenu(): void {
  if (tray) rebuildMenu()
}

function rebuildMenu(): void {
  if (!tray || !callbacks) return
  const widgetVisible = isWidgetVisible()
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open soloLeving',
      click: () => callbacks?.openMainWindow()
    },
    {
      label: widgetVisible ? 'Hide floating widget' : 'Show floating widget',
      click: () => {
        callbacks?.toggleWidget()
        // Label flips on the next rebuild; do it right away.
        setTimeout(() => rebuildMenu(), 0)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit soloLeving',
      click: () => callbacks?.quit()
    }
  ])
  tray.setContextMenu(menu)
}

/** Removes the tray (used on app shutdown). */
export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
