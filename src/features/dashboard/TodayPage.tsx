import { useEffect } from 'react'
import { CalendarX2, Sparkles } from 'lucide-react'
import type { HabitCategory } from '@shared/types'
import { CATEGORY_LABELS } from '@shared/constants/categories'
import { toLocalDateKey } from '@shared/utils/date'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useHabitsStore } from '@/stores/habits-store'
import { useTrackingStore } from '@/stores/tracking-store'
import { formatLongDate, getGreeting } from '@/utils/date'
import { DaySummaryCard } from '../tracking/DaySummaryCard'
import { HabitTodayRow } from '../tracking/HabitTodayRow'

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as HabitCategory[]

export function TodayPage(): React.JSX.Element {
  const now = new Date()
  const todayKey = toLocalDateKey(now)

  const { habits, status: habitsStatus, load } = useHabitsStore()
  const { snapshot, status, error, loadDay, clearError } = useTrackingStore()

  useEffect(() => {
    void load()
    void loadDay(todayKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey])

  const states = snapshot?.states ?? []
  const hasHabits = habits.some((habit) => habit.archivedAt === null)
  const loading = status === 'loading' || habitsStatus === 'loading'

  const grouped: Array<{ category: HabitCategory; states: typeof states }> = []
  for (const state of states) {
    let group = grouped.find((item) => item.category === state.habit.category)
    if (!group) {
      group = { category: state.habit.category, states: [] }
      grouped.push(group)
    }
    group.states.push(state)
  }
  grouped.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))

  return (
    <div>
      <PageHeader title={getGreeting(now)} subtitle={formatLongDate(now)} />

      {error ? (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-xs underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {loading && !snapshot ? (
        <p className="px-1 py-10 text-center text-sm text-muted">Loading your day…</p>
      ) : !hasHabits && habitsStatus === 'ready' ? (
        <div className="flex flex-col gap-6">
          <Card className="flex items-center gap-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12">
              <Sparkles className="size-5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <h2 className="font-medium text-foreground">Your day starts here</h2>
              <p className="mt-0.5 text-sm text-muted">
                Create habits in the My Habits section and they will appear here each day.
              </p>
            </div>
          </Card>
          <EmptyState
            icon={Sparkles}
            title="No habits yet"
            description="Head to My Habits and create your first habit to start building consistency."
          />
        </div>
      ) : states.length === 0 && status === 'ready' ? (
        <EmptyState
          icon={CalendarX2}
          title="Nothing scheduled today"
          description="None of your habits are due today. Enjoy the rest — unscheduled days never break your streaks."
        />
      ) : snapshot ? (
        <div className="flex flex-col gap-6">
          <Card>
            <DaySummaryCard progress={snapshot.progress} streak={snapshot.overallStreak} />
          </Card>

          {snapshot.activeTimer ? (
            <Card className="flex items-center gap-3 border-primary/30 bg-primary/5">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              <p className="text-sm text-muted">
                A timer is running for{' '}
                <span className="font-medium text-foreground">
                  {states.find((state) => state.habit.id === snapshot.activeTimer?.habitId)?.habit.name ??
                    'a habit'}
                </span>
                . Only one timer can run at a time.
              </p>
            </Card>
          ) : null}

          {grouped.map((group) => (
            <section key={group.category}>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {CATEGORY_LABELS[group.category]} · {group.states.length}
              </h3>
              <div className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60 bg-surface">
                {group.states.map((state) => (
                  <HabitTodayRow
                    key={state.habit.id}
                    state={state}
                    dateKey={todayKey}
                    activeTimer={snapshot.activeTimer}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}
