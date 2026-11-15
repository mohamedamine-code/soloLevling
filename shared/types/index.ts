export type TrackingType = 'boolean' | 'quantity' | 'duration'

export type HabitCategory =
  | 'spiritual'
  | 'health'
  | 'learning'
  | 'productivity'
  | 'personal'

export type ScheduleType = 'daily' | 'weekdays'

export interface HabitEntry {
  id: string
  habitId: string
  /** Local YYYY-MM-DD. */
  date: string
  type: TrackingType
  /**
   * boolean: always 1. quantity: accumulated units. duration: accumulated
   * minutes (may be fractional).
   */
  value: number
  createdAt: string
  updatedAt: string
}

export type DayOverrideStatus = 'skipped'

export interface HabitDayOverride {
  habitId: string
  date: string
  status: DayOverrideStatus
  createdAt: string
  updatedAt: string
}

export type HabitDayStatus = 'completed' | 'in_progress' | 'pending' | 'skipped'

/** A habit's state for one specific day (used by dashboard and widget). */
export interface HabitTrackingState {
  habit: Habit
  status: HabitDayStatus
  /** boolean: 0/1; quantity/duration: accumulated value. */
  actual: number
  /** 0..1 contribution toward the target. */
  progress: number
  skipped: boolean
}

export interface DayProgress {
  /**
   * 0–100 with one decimal. null when no habit counts today (nothing
   * scheduled or all skipped) — callers must show an empty state, not "0%".
   */
  percent: number | null
  /** Habits included in the denominator (scheduled, not skipped). */
  includedCount: number
  completedCount: number
}

export interface OverallStreak {
  current: number
  best: number
}

export interface ActiveTimerSession {
  id: string
  habitId: string
  date: string
  status: 'running' | 'paused'
  /** accumulated + (now − started_at when running), in seconds. */
  elapsedSeconds: number
  startedAt: string | null
}

export interface DaySnapshot {
  date: string
  states: HabitTrackingState[]
  progress: DayProgress
  overallStreak: OverallStreak
  activeTimer: ActiveTimerSession | null
}

export interface HabitSchedule {
  type: ScheduleType
  /** 0 = Sunday … 6 = Saturday. Used when type = 'weekdays'. */
  weekdays: number[]
  /** Local YYYY-MM-DD. */
  startDate: string
  /** Local YYYY-MM-DD, or null for open-ended. */
  endDate: string | null
}

export interface Habit {
  id: string
  name: string
  description: string
  category: HabitCategory
  trackingType: TrackingType
  /** Target per day. Always 1 for boolean habits. Must be > 0 otherwise. */
  targetValue: number
  /** Measurement unit ('pages', 'minutes', …). Empty for boolean habits. */
  unit: string
  /** Icon identifier (lucide name). Default derived from category. */
  icon: string
  color: string
  sortOrder: number
  isActive: boolean
  /** ISO datetime strings. */
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  schedule: HabitSchedule
}

export interface HabitCreateInput {
  name: string
  description?: string
  category: HabitCategory
  trackingType: TrackingType
  /** Required (> 0) for quantity/duration; ignored for boolean. */
  targetValue?: number
  unit?: string
  icon?: string
  color?: string
  schedule?: {
    type?: ScheduleType
    weekdays?: number[]
    /** Local YYYY-MM-DD; defaults to today when omitted. */
    startDate?: string
    endDate?: string | null
  }
}

export interface HabitUpdateInput {
  name?: string
  description?: string
  category?: HabitCategory
  trackingType?: TrackingType
  targetValue?: number
  unit?: string
  icon?: string
  color?: string
  isActive?: boolean
  schedule?: {
    type?: ScheduleType
    weekdays?: number[]
    startDate?: string
    endDate?: string | null
  }
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
}

// ---- Routines (Phase 5) ----

/** A reusable named group of existing habits (morning, evening, gym…). */
export interface Routine {
  id: string
  name: string
  description: string
  /** Member habits in display order. */
  habits: Habit[]
  createdAt: string
  updatedAt: string
}

export interface RoutineCreateInput {
  name: string
  description?: string
  /** Member habit ids in display order (active habits). */
  habitIds: string[]
}

export interface RoutineUpdateInput {
  name?: string
  description?: string
  /** When provided, replaces the member list entirely. */
  habitIds?: string[]
}

// ---- Range analytics (Phase 5) ----

/** Per-day aggregate over a date range (history/analytics). */
export interface DaySummaryPoint {
  date: string
  /** null when nothing counted that day. */
  percent: number | null
  /** Habits due that day (scheduled, not skipped). */
  includedCount: number
  completedCount: number
  skippedCount: number
  /** Scheduled but not completed (a real miss). */
  missedCount: number
}

/** Per-habit aggregate over a date range. */
export interface HabitRangeStats {
  habitId: string
  name: string
  trackingType: TrackingType
  unit: string
  color: string
  icon: string
  /** Days the habit counted (scheduled, not skipped, within range). */
  scheduledDays: number
  completedDays: number
  currentStreak: number
  bestStreak: number
  /** Accumulated actual over the range (boolean days completed, units, minutes). */
  totalValue: number
}

export interface RangeAnalytics {
  fromDate: string
  toDate: string
  days: DaySummaryPoint[]
  habits: HabitRangeStats[]
  /** Sum of all duration entries in the range, in minutes. */
  totalDurationMinutes: number
  /** Mean of non-null day percents; null when no day counted. */
  averagePercent: number | null
}

export interface BackupExportResult {
  /** Absolute path the backup was written to. */
  path: string
  sizeBytes: number
}

export interface BackupImportResult {
  /** Number of migrations applied on top of the restored file. */
  migrationsApplied: number
}
