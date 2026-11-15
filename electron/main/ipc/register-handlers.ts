import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type {
  DaySnapshot,
  HabitCreateInput,
  HabitUpdateInput,
  RangeAnalytics,
  RoutineCreateInput,
  RoutineUpdateInput
} from '@shared/types'
import { toLocalDateKey } from '@shared/utils/date'
import type { HabitService } from '../services/habit-service'
import type { TrackingService } from '../services/tracking-service'
import type { RoutineService } from '../services/routine-service'
import type { SettingsRepository } from '../db/repositories/settings-repository'
import { hideWidget, setWidgetVisible } from '../windows/widget-window'
import { sendTestNotification } from '../notifications/reminder-service'

export interface WidgetIpcDependencies {
  /** Focuses the main window, creating it first if it was closed. */
  openMainWindow: () => void
}

export interface IpcDependencies {
  habitService: HabitService
  trackingService: TrackingService
  routineService: RoutineService
  settings: SettingsRepository
  widget: WidgetIpcDependencies
}

/**
 * Central place to register all IPC handlers.
 * Each handler must validate inputs and only expose what the renderer needs.
 * Validation happens inside the services (Zod) — see docs/ipc-contracts.md.
 */

/**
 * Pushes a fresh snapshot to EVERY window (main + widget) so both stay in
 * sync without polling. This is the only main→renderer push event so far.
 */
function broadcastSnapshot(snapshot: DaySnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.TrackingSnapshotChanged, snapshot)
    }
  }
}

/** Runs a tracking mutation and broadcasts the resulting snapshot. */
function trackAndBroadcast(mutation: () => DaySnapshot): DaySnapshot {
  const snapshot = mutation()
  broadcastSnapshot(snapshot)
  return snapshot
}

export function registerIpcHandlers(deps: IpcDependencies): void {
  const { habitService, trackingService, routineService, settings, widget } = deps

  /** Habit list changes can affect what counts today — re-broadcast. */
  const broadcastTodaySnapshot = (): void => {
    try {
      broadcastSnapshot(trackingService.getDaySnapshot(toLocalDateKey(new Date())))
    } catch {
      // Snapshot failure (e.g. clock issues) must not break habit mutations.
    }
  }

  ipcMain.handle(IPC_CHANNELS.AppGetInfo, () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron ?? 'unknown',
      chrome: process.versions.chrome ?? 'unknown',
      node: process.versions.node ?? 'unknown'
    }
  })

  ipcMain.handle(IPC_CHANNELS.HabitsList, () => habitService.list())

  ipcMain.handle(IPC_CHANNELS.HabitsCreate, (_event, input: HabitCreateInput) => {
    const habit = habitService.create(input)
    broadcastTodaySnapshot()
    return habit
  })

  ipcMain.handle(IPC_CHANNELS.HabitsUpdate, (_event, id: string, input: HabitUpdateInput) => {
    const habit = habitService.update(id, input)
    broadcastTodaySnapshot()
    return habit
  })

  ipcMain.handle(IPC_CHANNELS.HabitsArchive, (_event, id: string) => {
    const habit = habitService.archive(id)
    broadcastTodaySnapshot()
    return habit
  })

  ipcMain.handle(IPC_CHANNELS.HabitsRestore, (_event, id: string) => {
    const habit = habitService.restore(id)
    broadcastTodaySnapshot()
    return habit
  })

  ipcMain.handle(IPC_CHANNELS.HabitsDelete, (_event, id: string) => {
    habitService.remove(id)
    broadcastTodaySnapshot()
  })

  ipcMain.handle(IPC_CHANNELS.HabitsReorder, (_event, orderedIds: string[]) => {
    const habits = habitService.reorder(orderedIds)
    broadcastTodaySnapshot()
    return habits
  })

  ipcMain.handle(IPC_CHANNELS.TrackingGetDay, (_event, date: string) =>
    trackingService.getDaySnapshot(date)
  )
  ipcMain.handle(IPC_CHANNELS.TrackingComplete, (_event, habitId: string, date: string) =>
    trackAndBroadcast(() => trackingService.complete(habitId, date))
  )
  ipcMain.handle(IPC_CHANNELS.TrackingUncomplete, (_event, habitId: string, date: string) =>
    trackAndBroadcast(() => trackingService.uncomplete(habitId, date))
  )
  ipcMain.handle(
    IPC_CHANNELS.TrackingSetQuantity,
    (_event, habitId: string, date: string, value: number) =>
      trackAndBroadcast(() => trackingService.setQuantity(habitId, date, value))
  )
  ipcMain.handle(
    IPC_CHANNELS.TrackingIncrementQuantity,
    (_event, habitId: string, date: string, delta: number) =>
      trackAndBroadcast(() =>
        trackingService.incrementQuantity(habitId, date, delta)
      )
  )
  ipcMain.handle(
    IPC_CHANNELS.TrackingAddDuration,
    (_event, habitId: string, date: string, minutes: number) =>
      trackAndBroadcast(() => trackingService.addDuration(habitId, date, minutes))
  )
  ipcMain.handle(IPC_CHANNELS.TrackingStartTimer, (_event, habitId: string, date: string) =>
    trackAndBroadcast(() => trackingService.startTimer(habitId, date))
  )
  ipcMain.handle(IPC_CHANNELS.TrackingPauseTimer, (_event, habitId: string) =>
    trackAndBroadcast(() => trackingService.pauseTimer(habitId))
  )
  ipcMain.handle(IPC_CHANNELS.TrackingResumeTimer, (_event, habitId: string) =>
    trackAndBroadcast(() => trackingService.resumeTimer(habitId))
  )
  ipcMain.handle(IPC_CHANNELS.TrackingStopTimer, (_event, habitId: string) =>
    trackAndBroadcast(() => trackingService.stopTimer(habitId))
  )
  ipcMain.handle(IPC_CHANNELS.TrackingGetActiveTimer, () => trackingService.getActiveTimerSession())
  ipcMain.handle(
    IPC_CHANNELS.TrackingGetRange,
    (_event, fromDate: string, toDate: string): RangeAnalytics =>
      trackingService.getRangeAnalytics(fromDate, toDate)
  )
  ipcMain.handle(IPC_CHANNELS.TrackingSkip, (_event, habitId: string, date: string) =>
    trackAndBroadcast(() => trackingService.skip(habitId, date))
  )
  ipcMain.handle(IPC_CHANNELS.TrackingUnskip, (_event, habitId: string, date: string) =>
    trackAndBroadcast(() => trackingService.unskip(habitId, date))
  )

  ipcMain.handle(IPC_CHANNELS.RoutinesList, () => routineService.list())
  ipcMain.handle(IPC_CHANNELS.RoutinesCreate, (_event, input: RoutineCreateInput) =>
    routineService.create(input)
  )
  ipcMain.handle(IPC_CHANNELS.RoutinesUpdate, (_event, id: string, input: RoutineUpdateInput) =>
    routineService.update(id, input)
  )
  ipcMain.handle(IPC_CHANNELS.RoutinesDelete, (_event, id: string) => routineService.delete(id))

  ipcMain.handle(IPC_CHANNELS.WidgetSetVisible, (_event, visible: unknown) => {    if (typeof visible !== 'boolean') {
      throw new Error('Visible must be a boolean')
    }
    setWidgetVisible(visible, settings)
  })
  ipcMain.handle(IPC_CHANNELS.WidgetHide, () => hideWidget())
  ipcMain.handle(IPC_CHANNELS.WidgetOpenMain, () => widget.openMainWindow())

  ipcMain.handle(IPC_CHANNELS.NotificationsTest, () => sendTestNotification())

  ipcMain.handle(IPC_CHANNELS.SettingsGet, (_event, key: string) => {
    validateSettingsKey(key)
    return settings.get(key)
  })

  ipcMain.handle(IPC_CHANNELS.SettingsSet, (_event, key: string, value: string) => {
    validateSettingsKey(key)
    if (typeof value !== 'string' || value.length > 2000) {
      throw new Error('Invalid setting value')
    }
    settings.set(key, value)
  })
}

function validateSettingsKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
    throw new Error('Invalid setting key')
  }
}
