import { app, BrowserWindow, shell } from 'electron'
import {
  createMainWindow,
  focusOrCreateMainWindow,
  type MainWindowOptions
} from './windows/main-window'
import { isSafeExternalUrl } from './windows/external-url'
import { showWidget, widgetVisibilitySetting, setWidgetVisible, isWidgetVisible } from './windows/widget-window'
import { initDatabase, MIGRATIONS } from './db'
import { HabitRepository } from './db/repositories/habit-repository'
import { SettingsRepository } from './db/repositories/settings-repository'
import { TrackingRepository } from './db/repositories/tracking-repository'
import { RoutineRepository } from './db/repositories/routine-repository'
import { HabitService } from './services/habit-service'
import { TrackingService } from './services/tracking-service'
import { RoutineService } from './services/routine-service'
import { BackupService } from './services/backup-service'
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

/** Everything derived from the open database; rebuilt after a restore. */
interface ServiceGraph {
  db: ReturnType<typeof initDatabase>
  habitService: HabitService
  trackingService: TrackingService
  routineService: RoutineService
  settings: SettingsRepository
}

/** Opens the database and wires repositories + services around it. */
function buildServiceGraph(userDataPath: string): ServiceGraph {
  const db = initDatabase(userDataPath)
  const habitRepository = new HabitRepository(db)
  const trackingRepository = new TrackingRepository(db)
  const routineRepository = new RoutineRepository(db, habitRepository)
  return {
    db,
    habitService: new HabitService(habitRepository),
    trackingService: new TrackingService(habitRepository, trackingRepository),
    routineService: new RoutineService(habitRepository, routineRepository),
    settings: new SettingsRepository(db)
  }
}

/** How many migrations a fresh open applies on top of `beforeVersion`. */
function migrationsAppliedSince(beforeVersion: number): number {
  return Math.max(...MIGRATIONS.map((migration) => migration.version)) - beforeVersion
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  let graph = buildServiceGraph(userDataPath)

  const backupService = new BackupService({
    userDataPath,
    dbFileName: 'sololeving.db'
  })
  // The live connection changes after every restore; the holder stays stable.
  const dbHolder = { get: () => graph.db }

  const mainWindowOptions: MainWindowOptions = {
    interceptClose: () => {
      // Close-to-tray only while the app is not quitting (tray Quit lets go).
      return !quitting && graph.settings.get('window.closeToTray') === '1'
    }
  }

  function registerCurrentHandlers(): void {
    registerIpcHandlers({
      habitService: graph.habitService,
      trackingService: graph.trackingService,
      routineService: graph.routineService,
      settings: graph.settings,
      widget: {
        // The widget's "open main window" button: focus or recreate the main window.
        openMainWindow: () => {
          focusOrCreateMainWindow()
        }
      },
      backup: {
        backupService,
        dbHolder,
        afterRestore: () => {
          const backupVersion = rebuildAfterRestore()
          return migrationsAppliedSince(backupVersion)
        }
      }
    })
  }

  /**
   * Rebuilds the service graph around the swapped-in database file,
   * re-registers handlers, reloads every renderer, and returns the schema
   * version the restored file was at BEFORE migrations were applied.
   */
  function rebuildAfterRestore(): number {
    const restoredVersion = backupService.maxMigrationVersion(backupService.liveDbPath)
    graph = buildServiceGraph(userDataPath)
    registerCurrentHandlers()
    mainWindowOptions.interceptClose = () => {
      return !quitting && graph.settings.get('window.closeToTray') === '1'
    }
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.reload()
      }
    }
    return restoredVersion
  }

  registerCurrentHandlers()
  createMainWindow(mainWindowOptions)

  // Widget last: it may present on top of the freshly created main window.
  if (widgetVisibilitySetting(graph.settings)) {
    showWidget(graph.settings)
  }

  // Tray: makes the app a background resident and provides the real exit.
  createTray({
    openMainWindow: () => {
      focusOrCreateMainWindow()
    },
    toggleWidget: () => {
      setWidgetVisible(!isWidgetVisible(), graph.settings)
      refreshTrayMenu()
    },
    quit: () => {
      quitting = true
      app.quit()
    }
  })

  // Daily habit reminders (Windows toasts), configured via the settings table.
  // Getters keep the reminder service pointed at the CURRENT service graph —
  // a database restore rebuilds it, and stale references would hit a closed db.
  startReminderService({
    get settings() {
      return graph.settings
    },
    get trackingService() {
      return graph.trackingService
    },
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

// Prevent untrusted content from navigating the main window. Internal URLs
// (app bundle, dev server) are allowed; validated http(s) URLs are handed to
// the OS browser; anything else is blocked outright (AGENTS.md rule).
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const isInternal = url.startsWith('file://') || url.startsWith('http://localhost')
    if (isInternal) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
  })
})
