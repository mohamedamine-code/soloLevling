export const APP_VIEWS = [
  'today',
  'habits',
  'routines',
  'analytics',
  'history',
  'settings'
] as const

export type AppView = (typeof APP_VIEWS)[number]

export interface ViewMeta {
  id: AppView
  label: string
  /** Status shown subtly in the sidebar until the feature is implemented. */
  pending?: boolean
}

export const VIEW_META: Record<AppView, ViewMeta> = {
  today: { id: 'today', label: 'Today' },
  habits: { id: 'habits', label: 'My Habits' },
  routines: { id: 'routines', label: 'Routines' },
  analytics: { id: 'analytics', label: 'Analytics' },
  history: { id: 'history', label: 'History' },
  settings: { id: 'settings', label: 'Settings' }
}
