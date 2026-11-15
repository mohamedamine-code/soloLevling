import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarCheck,
  History,
  ListChecks,
  Moon,
  Repeat,
  Settings as SettingsIcon,
  Sun
} from 'lucide-react'
import { VIEW_META, type AppView } from '@/app/router/views'
import { useNavigationStore } from '@/stores/navigation-store'
import { useThemeStore } from '@/stores/theme-store'
import { cn } from '@/utils/cn'

const viewIcons: Record<AppView, LucideIcon> = {
  today: CalendarCheck,
  habits: ListChecks,
  routines: Repeat,
  analytics: BarChart3,
  history: History,
  settings: SettingsIcon
}

function ThemeToggleButton(): React.JSX.Element {
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)
  const isDark = mode === 'dark' || (mode === 'system' && document.documentElement.classList.contains('dark'))

  return (
    <button
      type="button"
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'flex size-9 items-center justify-center rounded-lg text-muted',
        'transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary/60'
      )}
    >
      {isDark ? <Sun className="size-[18px]" strokeWidth={1.75} /> : <Moon className="size-[18px]" strokeWidth={1.75} />}
    </button>
  )
}

export function Sidebar(): React.JSX.Element {
  const activeView = useNavigationStore((state) => state.activeView)
  const setView = useNavigationStore((state) => state.setView)

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-on-primary">S</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-foreground">soloLeving</div>
          <div className="text-[11px] text-muted">Daily progress companion</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
        {(Object.keys(VIEW_META) as AppView[]).map((view) => {
          const meta = VIEW_META[view]
          const Icon = viewIcons[view]
          const active = activeView === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => setView(view)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-primary/60',
                active
                  ? 'bg-elevated font-medium text-foreground'
                  : 'text-muted hover:bg-elevated/60 hover:text-foreground'
              )}
            >
              <Icon
                className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-muted')}
                strokeWidth={1.75}
              />
              <span className="flex-1 text-left">{meta.label}</span>
              {meta.pending ? (
                <span
                  className="size-1.5 rounded-full bg-warning/60"
                  title="Under development"
                  aria-label="Under development"
                />
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
        <span className="text-[11px] text-muted">v0.1.0</span>
        <ThemeToggleButton />
      </div>
    </aside>
  )
}
