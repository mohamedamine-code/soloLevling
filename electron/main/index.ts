import { app, BrowserWindow } from 'electron'
import {
  createMainWindow,
  focusOrCreateMainWindow,
  type MainWindowOptions
} from './windows/main-window'
import { showWidget, widgetVisibilitySetting, setWidgetVisible, isWidgetVisible } from './windows/widget-window'
import { initDatabase } from './db'
import { HabitRepository } from './db/repositories/habit-repository'
import { SettingsRepository } from './db/repositories/settings-repository'
import { TrackingRepository } from './db/repositories/tracking-repository'
import { RoutineRepository } from './db/repositories/routine-repository'
import { HabitService } from './services/habit-service'
import { TrackingService } from './services/tracking-service'
import { RoutineService } from './services/routine-service'
import { registerIpcHandlers } from './ipc/register-handlers'
import { createTray, destroyTray, refreshTrayMenu } from './tray/tray'
import { startReminderService } from './notifications/reminder-service'

/**
 * soloLeving — Electron main process entry point.
 *
 * Responsibilities are split across modules:
 * - windows/       : BrowserWindow factories (main window, floating widget)
 * - tray/          : system tray (background resident + real exit)
 * - notifications/ : daily reminder service
 * - db/            : SQLite connection, migrations, repositories
 * - services/      : domain services (validation + business rules)
 * - ipc/           : IPC handler registration
 */
app.setName('soloLeving')

/** Set to true when the user quits via the tray, so close handlers let go. */
let quitting = false

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

  const mainWindowOptions: MainWindowOptions = {
    interceptClose: () => {
      // Close-to-tray only while the app is not quitting (tray Quit lets go).
      return !quitting && settings.get('window.closeToTray') === '1'
    }
  }

  registerIpcHandlers({
    habitService,
    trackingService,
    routineService,
    settings,
    widget: {
      // The widget's "open main window" button: focus or recreate the main window.
      openMainWindow: () => {
        focusOrCreateMainWindow()
      }
    }
  })
  createMainWindow(mainWindowOptions)

  // Widget last: it may present on top of the freshly created main window.
  if (widgetVisibilitySetting(settings)) {
    showWidget(settings)
  }

  // Tray: makes the app a background resident and provides the real exit.
  createTray({
    openMainWindow: () => {
      focusOrCreateMainWindow()
    },
    toggleWidget: () => {
      setWidgetVisible(!isWidgetVisible(), settings)
      refreshTrayMenu()
    },
    quit: () => {
      quitting = true
      app.quit()
    }
  })

  // Daily habit reminders (Windows toasts), configured via the settings table.
  startReminderService({
    settings,
    trackingService,
    openMainWindow: () => {
      focusOrCreateMainWindow()
    }
  })

  app.on('activate', () => {
    // macOS convention; harmless on Windows but keeps behavior correct if ported.
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(mainWindowOptions)
    }
  })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  destroyTray()
})

// The tray keeps the app alive when every window is closed (e.g. the user
// closed the main window while the widget is visible, or close-to-tray hid
// it). Quitting happens explicitly via the tray menu (or app.quit()).
app.on('window-all-closed', () => {
  if (quitting) {
    app.quit()
  }
  // Otherwise: stay resident in the tray.
})

// Prevent untrusted content from navigating the main window.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const isInternal = url.startsWith('file://') || url.startsWith('http://localhost')
    if (!isInternal) {
      event.preventDefault()
    }
  })
})
