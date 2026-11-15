import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { getAppIconPath } from './app-icon'

/**
 * Main application window.
 *
 * Security settings follow the Electron security checklist:
 * contextIsolation on, nodeIntegration off, sandbox on, narrow preload API.
 *
 * Close-to-tray: when enabled, closing the window hides it instead of
 * destroying it and the app stays resident in the tray. The behavior is
 * controlled by the `window.closeToTray` settings key ('1' = enabled).
 */
export interface MainWindowOptions {
  /**
   * Return true to intercept a user close and hide the window instead
   * (close-to-tray). Returning false lets the window close normally.
   */
  interceptClose: () => boolean
}

export function createMainWindow(options?: MainWindowOptions): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#111318',
    title: 'soloLeving',
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (options) {
    mainWindow.on('close', (event) => {
      if (options.interceptClose()) {
        event.preventDefault()
        mainWindow.hide()
      }
    })
  }

  // Open external links in the system browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/**
 * Focuses the main window, recreating it first if it was closed
 * (used by the widget's open-main button and the tray).
 */
export function focusOrCreateMainWindow(): BrowserWindow {
  const existing = BrowserWindow.getAllWindows().find((w) => w.title === 'soloLeving')
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    return existing
  }
  return createMainWindow()
}
