import { app, BrowserWindow, shell } from 'electron'
import { createMainWindow } from './windows/main-window'
import { showWidget, widgetVisibilitySetting } from './windows/widget-window'
import { initDatabase } from './db'
import { HabitRepository } from './db/repositories/habit-repository'
import { SettingsRepository } from './db/repositories/settings-repository'
import { TrackingRepository } from './db/repositories/tracking-repository'
import { RoutineRepository } from './db/repositories/routine-repository'
import { HabitService } from './services/habit-service'
import { TrackingService } from './services/tracking-service'
import { RoutineService } from './services/routine-service'
import { registerIpcHandlers } from './ipc/register-handlers'

/**
 * soloLeving — Electron main process entry point.
 *
 * Responsibilities are split across modules:
 * - windows/  : BrowserWindow factories (main window, later the floating widget)
 * - db/       : SQLite connection, migrations, repositories
 * - services/ : domain services (validation + business rules)
 * - ipc/      : IPC handler registration
 */
app.setName('soloLeving')

app.whenReady().then(() => {
  // Database first: IPC handlers depend on the repositories.
  const db = initDatabase(app.getPath('userData'))
  const habitRepository = new HabitRepository(db)
  const trackingRepository = new TrackingRepository(db)
  const routineRepository = new RoutineRepository(db, habitRepository)
  const habitService = new HabitService(habitRepository)
  const trackingService = new TrackingService(habitRepository, trackingRepository)
  const routineService = new RoutineService(habitRepository, routineRepository)
  const settings = new SettingsRepository(db)

  registerIpcHandlers({
    habitService,
    trackingService,
    routineService,
    settings,
    widget: {
      // The widget's "open main window" button: focus or recreate the main window.
      openMainWindow: () => {
        const existing = BrowserWindow.getAllWindows().find((w) => w.title === 'soloLeving')
        if (existing && !existing.isDestroyed()) {
          if (existing.isMinimized()) existing.restore()
          existing.show()
          existing.focus()
          return
        }
        createMainWindow()
      }
    }
  })
  createMainWindow()

  // Widget last: it may present on top of the freshly created main window.
  if (widgetVisibilitySetting(settings)) {
    showWidget(settings)
  }

  app.on('activate', () => {
    // macOS convention; harmless on Windows but keeps behavior correct if ported.
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// Quit when all windows are closed (Windows). With the widget visible the app
// intentionally keeps running (widget-only); the widget can reopen the main
// window. Tray-based background behavior is planned for Phase 6.
app.on('window-all-closed', () => {
  app.quit()
})

// Prevent untrusted content from navigating the main window.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const isInternal = url.startsWith('file://') || url.startsWith('http://localhost')
    if (!isInternal) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })
})
