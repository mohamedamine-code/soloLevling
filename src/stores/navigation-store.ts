import { create } from 'zustand'
import type { AppView } from '@/app/router/views'

interface NavigationState {
  activeView: AppView
  setView: (view: AppView) => void
}

/** UI-only navigation state. Not persisted: the app always opens on Today. */
export const useNavigationStore = create<NavigationState>((set) => ({
  activeView: 'today',
  setView: (view) => set({ activeView: view })
}))
