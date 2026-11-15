/**
 * Typed IPC channel names. Keep this list in sync with docs/ipc-contracts.md.
 * Handlers live in electron/main/ipc, invocations in electron/preload.
 */
export const IPC_CHANNELS = {
  AppGetInfo: 'app:get-info',
  HabitsList: 'habits:list',
  HabitsCreate: 'habits:create',
  HabitsUpdate: 'habits:update',
  HabitsArchive: 'habits:archive',
  HabitsRestore: 'habits:restore',
  HabitsDelete: 'habits:delete',
  HabitsReorder: 'habits:reorder',
  TrackingGetDay: 'tracking:get-day',
  TrackingComplete: 'tracking:complete',
  TrackingUncomplete: 'tracking:uncomplete',
  TrackingSetQuantity: 'tracking:set-quantity',
  TrackingIncrementQuantity: 'tracking:increment-quantity',
  TrackingAddDuration: 'tracking:add-duration',
  TrackingStartTimer: 'tracking:start-timer',
  TrackingPauseTimer: 'tracking:pause-timer',
  TrackingResumeTimer: 'tracking:resume-timer',
  TrackingStopTimer: 'tracking:stop-timer',
  TrackingGetActiveTimer: 'tracking:get-active-timer',
  TrackingSkip: 'tracking:skip',
  TrackingUnskip: 'tracking:unskip',
  TrackingGetRange: 'tracking:get-range',
  TrackingSnapshotChanged: 'tracking:snapshot-changed',
  RoutinesList: 'routines:list',
  RoutinesCreate: 'routines:create',
  RoutinesUpdate: 'routines:update',
  RoutinesDelete: 'routines:delete',
  WidgetSetVisible: 'widget:set-visible',
  WidgetHide: 'widget:hide',
  WidgetOpenMain: 'widget:open-main',
  NotificationsTest: 'notifications:test',
  BackupExport: 'backup:export',
  BackupImport: 'backup:import',
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
