import { useEffect, useState } from 'react'
import { Check, Flame, ExternalLink, Plus, X } from 'lucide-react'
import type { DaySnapshot, HabitTrackingState } from '@shared/types'
import { quantityStep } from '@shared/domain/progress'
import { toLocalDateKey } from '@shared/utils/date'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { TimerDisplay } from '@/features/tracking/TimerDisplay'
import { useTodayKey } from '@/utils/useTodayKey'
import { cn } from '@/utils/cn'

/**
 * The floating widget: a compact, always-on-top summary of today's progress
 * with quick toggles. Renders from the same DaySnapshot source of truth as
 * the main window and updates via broadcast events — no polling.
 */

export function WidgetApp(): React.JSX.Element {
  const todayKey = useTodayKey()
  const [snapshot, setSnapshot] = useState<DaySnapshot | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.soloLeving.tracking
      .getDay(todayKey)
      .then((value) => {
        if (!cancelled) setSnapshot(value)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFailed(error instanceof Error ? error.message : 'Could not load your day')
        }
      })
    const unsubscribe = window.soloLeving.tracking.onSnapshotChanged((value) => {
      if (value.date === todayKey) setSnapshot(value)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [todayKey])

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface/95 shadow-2xl backdrop-blur">
      <Header />
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {failed ? (
          <WidgetMessage text={failed} />
        ) : snapshot === null ? (
          <WidgetMessage text="Loading…" muted />
        ) : (
          <WidgetBody snapshot={snapshot} />
        )}
      </div>
    </div>
  )
}

function Header(): React.JSX.Element {
  return (
    <div className="mb-1 flex items-center gap-2 px-3 py-2 [-webkit-app-region:drag]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        soloLeving
      </span>
      <span className="flex-1" />
      <HeaderButton
        label="Open main window"
        onClick={() => void window.soloLeving.widget.openMain()}
      >
        <ExternalLink className="size-3.5" strokeWidth={1.75} />
      </HeaderButton>
      <HeaderButton label="Hide widget" onClick={() => void window.soloLeving.widget.hide()}>
        <X className="size-3.5" strokeWidth={1.75} />
      </HeaderButton>
    </div>
  )
}

function HeaderButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground [-webkit-app-region:no-drag]"
    >
      {children}
    </button>
  )
}

function WidgetBody({ snapshot }: { snapshot: DaySnapshot }): React.JSX.Element {
  const { progress, overallStreak, states, activeTimer } = snapshot
  const percentDisplay = progress.percent === null ? null : Math.round(progress.percent)

  if (states.length === 0) {
    return <WidgetMessage text="No habits scheduled today. Enjoy your rest!" />
  }

  const timerHabit = activeTimer
    ? states.find((state) => state.habit.id === activeTimer.habitId)
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-1 pt-1">
        <CircularProgress value={progress.percent ?? 0} size={72} strokeWidth={7}>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {percentDisplay === null ? '–' : `${percentDisplay}%`}
          </span>
        </CircularProgress>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {progress.completedCount} of {progress.includedCount} done
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted">
            <Flame className="size-3.5 text-warning" strokeWidth={1.75} />
            <span className="tabular-nums">{overallStreak.current}</span>
            day streak
          </div>
        </div>
      </div>

      {timerHabit && activeTimer ? (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          <span className="min-w-0 truncate text-muted">{timerHabit.habit.name}</span>
          <span className="flex-1" />
          <TimerDisplay key={activeTimer.id + ':' + activeTimer.status} session={activeTimer} />
        </div>
      ) : null}

      <div className="flex flex-col">
        {states.map((state) => (
          <WidgetRow key={state.habit.id} state={state} />
        ))}
      </div>
    </div>
  )
}

function WidgetRow({ state }: { state: HabitTrackingState }): React.JSX.Element {
  const { habit, status, actual, skipped } = state
  const dateKey = toLocalDateKey(new Date())

  const toggleBoolean = (): void => {
    const api = window.soloLeving.tracking
    void (status === 'completed' ? api.uncomplete(habit.id, dateKey) : api.complete(habit.id, dateKey))
  }

  const incrementQuantity = (): void => {
    void window.soloLeving.tracking.incrementQuantity(habit.id, dateKey, quantityStep(habit))
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5',
        skipped ? 'opacity-50' : 'hover:bg-elevated/50'
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
        aria-hidden="true"
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs text-foreground',
          status === 'completed' && 'text-muted line-through'
        )}
      >
        {habit.name}
      </span>

      {skipped ? (
        <span className="text-[10px] uppercase tracking-wide text-muted">skipped</span>
      ) : (
        <>
          {status === 'completed' ? (
            <span className="text-[10px] uppercase tracking-wide text-primary">done</span>
          ) : (
            <span className="text-[10px] tabular-nums text-muted">
              {Number.isInteger(actual) ? actual.toFixed(0) : actual.toFixed(1)}
              {habit.trackingType !== 'boolean' ? `/${habit.targetValue}` : ''}
            </span>
          )}
          {habit.trackingType === 'boolean' ? (
            <RowButton
              label={status === 'completed' ? 'Mark as not completed' : 'Mark as completed'}
              onClick={toggleBoolean}
              active={status === 'completed'}
            >
              <Check className="size-3.5" strokeWidth={2.25} />
            </RowButton>
          ) : null}
          {habit.trackingType === 'quantity' ? (
            <RowButton label={`Add ${quantityStep(habit)}`} onClick={incrementQuantity}>
              <Plus className="size-3.5" strokeWidth={2} />
            </RowButton>
          ) : null}
        </>
      )}
    </div>
  )
}

function RowButton({
  label,
  onClick,
  active = false,
  children
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-primary/12 text-primary'
          : 'text-muted hover:bg-elevated hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function WidgetMessage({ text, muted = false }: { text: string; muted?: boolean }): React.JSX.Element {
  return (
    <div className="flex h-full min-h-32 items-center justify-center px-4 text-center">
      <p className={cn('text-xs', muted ? 'text-muted/70' : 'text-muted')}>{text}</p>
    </div>
  )
}
