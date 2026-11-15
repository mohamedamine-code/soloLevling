import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc-channels'
import type { SoloLevingApi } from '@shared/contracts/api'
import type { DaySnapshot } from '@shared/types'

/**
 * Narrow, typed preload API. Nothing else is exposed to the renderer.
 */
const api: SoloLevingApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.AppGetInfo)
  },
  habits: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.HabitsList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.HabitsCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.HabitsUpdate, id, input),
    archive: (id) => ipcRenderer.invoke(IPC_CHANNELS.HabitsArchive, id),
    restore: (id) => ipcRenderer.invoke(IPC_CHANNELS.HabitsRestore, id),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.HabitsDelete, id),
    reorder: (orderedIds) => ipcRenderer.invoke(IPC_CHANNELS.HabitsReorder, orderedIds)
  },
  tracking: {
    getDay: (date) => ipcRenderer.invoke(IPC_CHANNELS.TrackingGetDay, date),
    complete: (habitId, date) => ipcRenderer.invoke(IPC_CHANNELS.TrackingComplete, habitId, date),
    uncomplete: (habitId, date) => ipcRenderer.invoke(IPC_CHANNELS.TrackingUncomplete, habitId, date),
    setQuantity: (habitId, date, value) =>
      ipcRenderer.invoke(IPC_CHANNELS.TrackingSetQuantity, habitId, date, value),
    incrementQuantity: (habitId, date, delta) =>
      ipcRenderer.invoke(IPC_CHANNELS.TrackingIncrementQuantity, habitId, date, delta),
    addDuration: (habitId, date, minutes) =>
      ipcRenderer.invoke(IPC_CHANNELS.TrackingAddDuration, habitId, date, minutes),
    startTimer: (habitId, date) => ipcRenderer.invoke(IPC_CHANNELS.TrackingStartTimer, habitId, date),
    pauseTimer: (habitId) => ipcRenderer.invoke(IPC_CHANNELS.TrackingPauseTimer, habitId),
    resumeTimer: (habitId) => ipcRenderer.invoke(IPC_CHANNELS.TrackingResumeTimer, habitId),
    stopTimer: (habitId) => ipcRenderer.invoke(IPC_CHANNELS.TrackingStopTimer, habitId),
    getActiveTimer: () => ipcRenderer.invoke(IPC_CHANNELS.TrackingGetActiveTimer),
    getRange: (fromDate, toDate) =>
      ipcRenderer.invoke(IPC_CHANNELS.TrackingGetRange, fromDate, toDate),
    skip: (habitId, date) => ipcRenderer.invoke(IPC_CHANNELS.TrackingSkip, habitId, date),
    unskip: (habitId, date) => ipcRenderer.invoke(IPC_CHANNELS.TrackingUnskip, habitId, date),
    /**
     * Subscribes to snapshot pushes broadcast by the main process after any
     * tracking or habit mutation. Returns an unsubscribe function.
     */
    onSnapshotChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: DaySnapshot): void => {
        callback(snapshot)
      }
      ipcRenderer.on(IPC_CHANNELS.TrackingSnapshotChanged, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.TrackingSnapshotChanged, listener)
      }
    }
  },
  widget: {
    setVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.WidgetSetVisible, visible),
    hide: () => ipcRenderer.invoke(IPC_CHANNELS.WidgetHide),
    openMain: () => ipcRenderer.invoke(IPC_CHANNELS.WidgetOpenMain)
  },
  settings: {
    get: (key) => ipcRenderer.invoke(IPC_CHANNELS.SettingsGet, key),
    set: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SettingsSet, key, value)
  },
  routines: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.RoutinesList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.RoutinesCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.RoutinesUpdate, id, input),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.RoutinesDelete, id)
  }
}

contextBridge.exposeInMainWorld('soloLeving', api)
