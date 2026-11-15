import { create } from 'zustand'
import type { DaySnapshot } from '@shared/types'
import type { SoloLevingApi } from '@shared/contracts/api'

export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'error'

interface TrackingState {
  snapshot: DaySnapshot | null
  status: TrackingStatus
  error: string | null
  loadDay: (dateKey: string) => Promise<void>
  complete: (habitId: string, dateKey: string) => Promise<void>
  uncomplete: (habitId: string, dateKey: string) => Promise<void>
  setQuantity: (habitId: string, dateKey: string, value: number) => Promise<void>
  incrementQuantity: (habitId: string, dateKey: string, delta: number) => Promise<void>
  addDuration: (habitId: string, dateKey: string, minutes: number) => Promise<void>
  startTimer: (habitId: string, dateKey: string) => Promise<void>
  pauseTimer: (habitId: string) => Promise<void>
  resumeTimer: (habitId: string) => Promise<void>
  stopTimer: (habitId: string) => Promise<void>
  skip: (habitId: string, dateKey: string) => Promise<void>
  unskip: (habitId: string, dateKey: string) => Promise<void>
  clearError: () => void
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

/**
 * Runs a tracking mutation and replaces the whole snapshot with the fresh
 * one the main process returns — a single source of truth shared with the
 * (future) widget.
 */
async function apply(
  set: (partial: Partial<TrackingState>) => void,
  mutation: (api: SoloLevingApi['tracking']) => Promise<DaySnapshot>
): Promise<void> {
  set({ error: null })
  try {
    const snapshot = await mutation(window.soloLeving.tracking)
    set({ snapshot, status: 'ready' })
  } catch (error) {
    set({ error: toErrorMessage(error) })
  }
}

export const useTrackingStore = create<TrackingState>((set) => {
  const tracking = window.soloLeving.tracking
  return {
    snapshot: null,
    status: 'idle',
    error: null,

    loadDay: async (dateKey) => {
      if (useTrackingStore.getState().status === 'loading') return
      set({ status: 'loading', error: null })
      try {
        const snapshot = await tracking.getDay(dateKey)
        set({ snapshot, status: 'ready' })
      } catch (error) {
        set({ status: 'error', error: toErrorMessage(error) })
      }
    },

    complete: async (habitId, dateKey) => {
      await apply(set, (api) => api.complete(habitId, dateKey))
    },
    uncomplete: async (habitId, dateKey) => {
      await apply(set, (api) => api.uncomplete(habitId, dateKey))
    },
    setQuantity: async (habitId, dateKey, value) => {
      await apply(set, (api) => api.setQuantity(habitId, dateKey, value))
    },
    incrementQuantity: async (habitId, dateKey, delta) => {
      await apply(set, (api) => api.incrementQuantity(habitId, dateKey, delta))
    },
    addDuration: async (habitId, dateKey, minutes) => {
      await apply(set, (api) => api.addDuration(habitId, dateKey, minutes))
    },
    startTimer: async (habitId, dateKey) => {
      await apply(set, (api) => api.startTimer(habitId, dateKey))
    },
    pauseTimer: async (habitId) => {
      await apply(set, (api) => api.pauseTimer(habitId))
    },
    resumeTimer: async (habitId) => {
      await apply(set, (api) => api.resumeTimer(habitId))
    },
    stopTimer: async (habitId) => {
      await apply(set, (api) => api.stopTimer(habitId))
    },
    skip: async (habitId, dateKey) => {
      await apply(set, (api) => api.skip(habitId, dateKey))
    },
    unskip: async (habitId, dateKey) => {
      await apply(set, (api) => api.unskip(habitId, dateKey))
    },
    clearError: () => set({ error: null })
  }
})

// Live sync: when any window (this one or the widget) mutates tracking, the
// main process broadcasts the fresh snapshot. Replace ours when it matches
// the day we are viewing — both surfaces always render the same truth.
window.soloLeving.tracking.onSnapshotChanged((snapshot) => {
  const current = useTrackingStore.getState().snapshot
  if (current !== null && current.date === snapshot.date) {
    useTrackingStore.setState({ snapshot, error: null })
  }
})
