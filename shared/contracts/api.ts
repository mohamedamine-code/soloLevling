import type {
  ActiveTimerSession,
  AppInfo,
  DaySnapshot,
  Habit,
  HabitCreateInput,
  HabitUpdateInput,
  RangeAnalytics,
  Routine,
  RoutineCreateInput,
  RoutineUpdateInput
} from '../types'
/**
 * Public renderer API exposed through the Electron preload (contextBridge).
 *
 * Rules:
 * - Only explicitly whitelisted, narrow methods may be exposed.
 * - Every method corresponds to a documented IPC channel in docs/ipc-contracts.md.
 * - The renderer must never receive direct Node.js or database access.
 * - Inputs are validated again in the main process — the renderer's validation
 *   is for UX only.
 *
 * Convention: tracking mutations return a fresh `DaySnapshot` so the dashboard
 * and (later) the widget always render the same source of truth.
 */
export interface SoloLevingApi {
  app: {
    /** Static application/environment information (name, versions). */
    getInfo(): Promise<AppInfo>
  }
  habits: {
    /** All habits (active and archived), ordered by sort order. */
    list(): Promise<Habit[]>
    create(input: HabitCreateInput): Promise<Habit>
    update(id: string, input: HabitUpdateInput): Promise<Habit>
    archive(id: string): Promise<Habit>
    restore(id: string): Promise<Habit>
    /** Permanently deletes the habit and its schedule. */
    remove(id: string): Promise<void>
    /** Persists a new display order; returns the reordered list. */
    reorder(orderedIds: string[]): Promise<Habit[]>
  }
  tracking: {
    getDay(date: string): Promise<DaySnapshot>
    complete(habitId: string, date: string): Promise<DaySnapshot>
    uncomplete(habitId: string, date: string): Promise<DaySnapshot>
    /** Replaces today's accumulated quantity value (manual edit). */
    setQuantity(habitId: string, date: string, value: number): Promise<DaySnapshot>
    /** Adds a delta to today's quantity, clamped at 0. */
    incrementQuantity(habitId: string, date: string, delta: number): Promise<DaySnapshot>
    /** Appends a manual duration entry (minutes). */
    addDuration(habitId: string, date: string, minutes: number): Promise<DaySnapshot>
    startTimer(habitId: string, date: string): Promise<DaySnapshot>
    pauseTimer(habitId: string): Promise<DaySnapshot>
    resumeTimer(habitId: string): Promise<DaySnapshot>
    stopTimer(habitId: string): Promise<DaySnapshot>
    getActiveTimer(): Promise<ActiveTimerSession | null>
    skip(habitId: string, date: string): Promise<DaySnapshot>
    unskip(habitId: string, date: string): Promise<DaySnapshot>
    /**
     * Subscribes to snapshot pushes broadcast by the main process after any
     * tracking or habit mutation (main → renderer event). Returns an
     * unsubscribe function. Used to keep the dashboard and widget in sync.
     */
    onSnapshotChanged(callback: (snapshot: DaySnapshot) => void): () => void
    /** Per-day + per-habit aggregates over an inclusive local-date range. */
    getRange(fromDate: string, toDate: string): Promise<RangeAnalytics>
  }
  widget: {
    /** Shows (creating if needed) or hides the floating widget; persists the choice. */
    setVisible(visible: boolean): Promise<void>
    /** Hides the widget without persisting (used by the widget's own close button). */
    hide(): Promise<void>
    /** Focuses the main window, recreating it if it was closed. */
    openMain(): Promise<void>
  }
  notifications: {
    /** Shows an immediate test notification; rejects if notifications are unsupported. */
    test(): Promise<void>
  }
  settings: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
  }
  routines: {
    /** All routines with member habits resolved in display order. */
    list(): Promise<Routine[]>
    create(input: RoutineCreateInput): Promise<Routine>
    update(id: string, input: RoutineUpdateInput): Promise<Routine>
    /** Permanently deletes the routine (members' habits are untouched). */
    remove(id: string): Promise<void>
  }
}
