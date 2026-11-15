import { useEffect, useState } from 'react'
import {
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Pause,
  Minus
} from 'lucide-react'
import type { DaySnapshot } from '@shared/types'
import { addDaysToKey, toLocalDateKey } from '@shared/utils/date'
import { formatTargetProgress } from '@shared/domain/progress'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'

/**
 * Day-by-day history: browse any past day and see exactly what was completed,
 * missed (scheduled but not done), or skipped. Read-only — past days are
 * records, not editable surfaces.
 */
export function HistoryPage(): React.JSX.Element {
  const todayKey = toLocalDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey)

  return (
    <div>
      <PageHeader title="History" subtitle="Browse previous days: completed, missed and skipped." />

      <Card className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Previous day"
          onClick={() => setSelectedDate((date) => addDaysToKey(date, -1))}
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </Button>
        <input
          type="date"
          value={selectedDate}
          max={todayKey}
          onChange={(event) => {
            if (event.target.value !== '') setSelectedDate(event.target.value)
          }}
          aria-label="Select a day"
          className="h-8 rounded-lg bg-elevated px-3 text-sm tabular-nums text-foreground focus:outline-2 focus:outline-primary/60"
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label="Next day"
          disabled={selectedDate >= todayKey}
          onClick={() => setSelectedDate((date) => addDaysToKey(date, 1))}
        >
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </Button>
        {selectedDate !== todayKey ? (
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayKey)}>
            Today
          </Button>
        ) : null}
      </Card>

      {/* Keyed remount: the day's load state re-initializes per selection. */}
      <HistoryContent key={selectedDate} selectedDate={selectedDate} todayKey={todayKey} />
    </div>
  )
}

function HistoryContent({
  selectedDate,
  todayKey
}: {
  selectedDate: string
  todayKey: string
}): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<DaySnapshot | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Live refresh: a mutation affecting the viewed day re-fetches it.
  useEffect(() => {
    return window.soloLeving.tracking.onSnapshotChanged((value) => {
      if (value.date === selectedDate) setRefreshKey((key) => key + 1)
    })
  }, [selectedDate])

  useEffect(() => {
    let cancelled = false
    void window.soloLeving.tracking
      .getDay(selectedDate)
      .then((value) => {
        if (cancelled) return
        setSnapshot(value)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'Could not load that day')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [selectedDate, refreshKey])

  const isFuture = selectedDate > todayKey
  const isPast = selectedDate < todayKey

  if (status === 'error') {
    return <Card className="p-6 text-sm text-danger">{error}</Card>
  }
  if (snapshot === null) {
    return <p className="px-1 py-10 text-center text-sm text-muted">Loading that day…</p>
  }
  if (snapshot.states.length === 0) {
    return (
      <Card>
        <EmptyHistoryDay isFuture={isFuture} />
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-6">
          <CircularProgress value={snapshot.progress.percent ?? 0} size={84} strokeWidth={7}>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {snapshot.progress.percent === null
                ? '–'
                : `${Math.round(snapshot.progress.percent)}%`}
            </span>
          </CircularProgress>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-foreground">{formatDayLabel(selectedDate)}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {snapshot.progress.percent === null
                ? 'Nothing was scheduled for this day.'
                : `${snapshot.progress.completedCount} of ${snapshot.progress.includedCount} habits completed`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={snapshot.overallStreak.current > 0 ? 'success' : 'muted'}>
                {snapshot.overallStreak.current} day streak (as of this day)
              </Badge>
              {isFuture ? <Badge tone="warning">Future day</Badge> : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60 bg-surface">
        {snapshot.states.map((state) => (
          <HistoryRow key={state.habit.id} state={state} isPast={isPast} />
        ))}
      </div>
    </div>
  )
}

function HistoryRow({
  state,
  isPast
}: {
  state: DaySnapshot['states'][number]
  isPast: boolean
}): React.JSX.Element {
  const { habit, status, actual, skipped } = state

  const badge = ((): { tone: 'success' | 'muted' | 'warning' | 'neutral'; label: string; icon: typeof Check } => {
    if (skipped) return { tone: 'warning', label: 'Skipped', icon: CircleSlash }
    switch (status) {
      case 'completed':
        return { tone: 'success', label: 'Completed', icon: Check }
      case 'in_progress':
        return { tone: 'neutral', label: 'Partial', icon: Pause }
      case 'pending':
        return isPast
          ? { tone: 'muted', label: 'Missed', icon: Minus }
          : { tone: 'neutral', label: 'Scheduled', icon: CalendarCheck2 }
      case 'skipped':
        return { tone: 'warning', label: 'Skipped', icon: CircleSlash }
    }
  })()
  const Icon = badge.icon

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', skipped && 'opacity-55')}>
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{habit.name}</div>
        <div className="text-xs text-muted">{formatTargetProgress(habit, actual)}</div>
      </div>
      <Badge tone={badge.tone}>
        <Icon className="mr-1 size-3" strokeWidth={1.75} />
        {badge.label}
      </Badge>
    </div>
  )
}

function EmptyHistoryDay({ isFuture }: { isFuture: boolean }): React.JSX.Element {
  return (
    <div className="py-10 text-center">
      <CalendarCheck2 className="mx-auto mb-3 size-8 text-muted/60" strokeWidth={1.5} />
      <h2 className="font-medium text-foreground">
        {isFuture ? 'This day has not started yet' : 'Nothing scheduled on this day'}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        {isFuture
          ? 'Pick a day up to today to browse your records.'
          : 'Days with no scheduled habits never break streaks — rest days are free.'}
      </p>
    </div>
  )
}

function formatDayLabel(key: string): string {
  const todayKey = toLocalDateKey(new Date())
  if (key === todayKey) return 'Today'
  if (key === addDaysToKey(todayKey, -1)) return 'Yesterday'
  return new Date(key.replace(/-/g, '/')).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
