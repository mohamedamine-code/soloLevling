import { create } from 'zustand'
import type { Routine, RoutineCreateInput, RoutineUpdateInput } from '@shared/types'

export type RoutinesStatus = 'idle' | 'loading' | 'ready' | 'error'

interface RoutinesState {
  routines: Routine[]
  status: RoutinesStatus
  error: string | null
  load: () => Promise<void>
  create: (input: RoutineCreateInput) => Promise<Routine | null>
  update: (id: string, input: RoutineUpdateInput) => Promise<Routine | null>
  remove: (id: string) => Promise<boolean>
  clearError: () => void
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export const useRoutinesStore = create<RoutinesState>((set, get) => {
  const api = window.soloLeving.routines
  return {
    routines: [],
    status: 'idle',
    error: null,

    load: async () => {
      if (get().status === 'loading') return
      set({ status: 'loading', error: null })
      try {
        const routines = await api.list()
        set({ routines, status: 'ready' })
      } catch (error) {
        set({ status: 'error', error: toErrorMessage(error) })
      }
    },

    create: async (input) => {
      try {
        const routine = await api.create(input)
        set((state) => ({ routines: [...state.routines, routine], error: null }))
        return routine
      } catch (error) {
        set({ error: toErrorMessage(error) })
        return null
      }
    },

    update: async (id, input) => {
      try {
        const routine = await api.update(id, input)
        set((state) => ({
          routines: state.routines.map((item) => (item.id === id ? routine : item)),
          error: null
        }))
        return routine
      } catch (error) {
        set({ error: toErrorMessage(error) })
        return null
      }
    },

    remove: async (id) => {
      try {
        await api.remove(id)
        set((state) => ({ routines: state.routines.filter((item) => item.id !== id), error: null }))
        return true
      } catch (error) {
        set({ error: toErrorMessage(error) })
        return false
      }
    },

    clearError: () => set({ error: null })
  }
})
