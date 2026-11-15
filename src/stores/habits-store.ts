import { create } from 'zustand'
import type { Habit, HabitCreateInput, HabitUpdateInput } from '@shared/types'

export type HabitsStatus = 'idle' | 'loading' | 'ready' | 'error'

interface HabitsState {
  habits: Habit[]
  status: HabitsStatus
  /** Load/action error surfaced as a banner on the pages. */
  actionError: string | null
  /** Validation/submit error surfaced inside the habit form dialog. */
  formError: string | null
  load: () => Promise<void>
  create: (input: HabitCreateInput) => Promise<Habit | null>
  update: (id: string, input: HabitUpdateInput) => Promise<Habit | null>
  archive: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Moves a habit one slot up/down and persists the new order. */
  move: (id: string, direction: 'up' | 'down') => Promise<void>
  clearFormError: () => void
  clearActionError: () => void
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  status: 'idle',
  actionError: null,
  formError: null,

  load: async () => {
    if (get().status === 'loading') return
    set({ status: 'loading' })
    try {
      const habits = await window.soloLeving.habits.list()
      set({ habits, status: 'ready' })
    } catch (error) {
      set({ status: 'error', actionError: toErrorMessage(error) })
    }
  },

  create: async (input) => {
    set({ formError: null })
    try {
      const habit = await window.soloLeving.habits.create(input)
      set((state) => ({ habits: [...state.habits, habit] }))
      return habit
    } catch (error) {
      set({ formError: toErrorMessage(error) })
      return null
    }
  },

  update: async (id, input) => {
    set({ formError: null })
    try {
      const habit = await window.soloLeving.habits.update(id, input)
      set((state) => ({
        habits: state.habits.map((item) => (item.id === id ? habit : item))
      }))
      return habit
    } catch (error) {
      set({ formError: toErrorMessage(error) })
      return null
    }
  },

  archive: async (id) => {
    set({ actionError: null })
    try {
      const habit = await window.soloLeving.habits.archive(id)
      set((state) => ({
        habits: state.habits.map((item) => (item.id === id ? habit : item))
      }))
    } catch (error) {
      set({ actionError: toErrorMessage(error) })
    }
  },

  restore: async (id) => {
    set({ actionError: null })
    try {
      const habit = await window.soloLeving.habits.restore(id)
      set((state) => ({
        habits: state.habits.map((item) => (item.id === id ? habit : item))
      }))
    } catch (error) {
      set({ actionError: toErrorMessage(error) })
    }
  },

  remove: async (id) => {
    set({ actionError: null })
    try {
      await window.soloLeving.habits.remove(id)
      set((state) => ({ habits: state.habits.filter((item) => item.id !== id) }))
    } catch (error) {
      set({ actionError: toErrorMessage(error) })
    }
  },

  move: async (id, direction) => {
    const habits = [...get().habits]
    const index = habits.findIndex((habit) => habit.id === id)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const current = habits[index]
    const target = habits[targetIndex]
    if (!current || !target) return

    habits[index] = target
    habits[targetIndex] = current
    // Optimistic update; rolled back by reloading on failure.
    const orderedIds = habits.map((habit) => habit.id)
    set({ habits, actionError: null })
    try {
      const updated = await window.soloLeving.habits.reorder(orderedIds)
      set({ habits: updated })
    } catch (error) {
      set({ actionError: toErrorMessage(error) })
      await get().load()
    }
  },

  clearFormError: () => set({ formError: null }),
  clearActionError: () => set({ actionError: null })
}))
