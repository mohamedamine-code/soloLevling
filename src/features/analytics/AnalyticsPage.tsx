import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { CalendarRange, ChartColumn, Flame, Timer } from 'lucide-react'
import type { RangeAnalytics } from '@shared/types'
import {
  addDaysToKey,
  formatMinutes,
  toLocalDateKey
} from '@shared/utils/date'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { cn } from '@/utils/cn'

/**
 * Analytics over a real data range — daily completion, per-habit performance
 * with lifetime streaks, time totals, and a consistency heatmap. Unscheduled
 * days are never counted as failures; empty ranges show honest states.
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' }
] as const

type RangeDays = (typeof RANGES)[number]['days']

export function AnalyticsPage(): React.JSX.Element {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30)

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Completion, consistency, and performance over real tracked data."
        actions={
          <div className="inline-flex rounded-lg bg-elevated p-1" role="radiogroup" aria-label="Range">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                role="radio"
                aria-checked={rangeDays === range.days}
                onClick={() => setRangeDays(range.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  rangeDays === range.days
                    ? 'bg-surface font-medium text-foreground shadow-sm'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Keyed remount: state (incl. load status) re-initializes per range. */}
      <AnalyticsContent key={rangeDays} rangeDays={rangeDays} />
    </div>
  )
}

function AnalyticsContent({ rangeDays }: { rangeDays: RangeDays }): React.JSX.Element {
  const [analytics, setAnalytics] = useState<RangeAnalytics | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Live refresh: any tracking mutation inside the viewed range re-fetches.
  useEffect(() => {
    const from = addDaysToKey(toLocalDateKey(new Date()), -(rangeDays - 1))
    return window.soloLeving.tracking.onSnapshotChanged((snapshot) => {
      if (snapshot.date >= from) setRefreshKey((key) => key + 1)
    })
  }, [rangeDays])

  useEffect(() => {
    let cancelled = false
    const today = toLocalDateKey(new Date())
    const from = addDaysToKey(today, -(rangeDays - 1))
    void window.soloLeving.tracking
      .getRange(from, today)
      .then((value) => {
        if (cancelled) return
        setAnalytics(value)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'Could not load analytics')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [rangeDays, refreshKey])

  if (status === 'error') {
    return <Card className="p-6 text-sm text-danger">{error}</Card>
  }
  if (analytics === null) {
    return <p className="px-1 py-10 text-center text-sm text-muted">Loading analytics…</p>
  }
  if (analytics.days.every((day) => day.percent === null)) {
    return (
      <Card>
        <EmptyAnalytics />
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <StatCards analytics={analytics} />
      <DailyChart analytics={analytics} />
      <HabitPerformance analytics={analytics} />
      <ConsistencyHeatmap analytics={analytics} />
    </div>
  )
}

function StatCards({ analytics }: { analytics: RangeAnalytics }): React.JSX.Element {
  const scheduledTotal = analytics.days.reduce((sum, day) => sum + day.includedCount, 0)
  const completedTotal = analytics.days.reduce((sum, day) => sum + day.completedCount, 0)
  const consistency =
    scheduledTotal === 0 ? null : Math.round((completedTotal / scheduledTotal) * 100)

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        icon={ChartColumn}
        label="Consistency"
        value={consistency === null ? '–' : `${consistency}%`}
        hint="of counted habits completed"
      />
      <StatCard
        icon={Flame}
        label="Average day"
        value={analytics.averagePercent === null ? '–' : `${Math.round(analytics.averagePercent)}%`}
        hint={`${scheduledTotal} habits due · ${completedTotal} done`}
      />
      <StatCard
        icon={Timer}
        label="Time tracked"
        value={formatMinutes(analytics.totalDurationMinutes)}
        hint="duration entries in range"
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: typeof ChartColumn
  label: string
  value: string
  hint: string
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="size-4" strokeWidth={1.75} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{hint}</div>
    </Card>
  )
}

function DailyChart({ analytics }: { analytics: RangeAnalytics }): React.JSX.Element {
  const data = analytics.days.filter((day) => day.percent !== null)
  const maxLabelCount = 14
  const labelEvery = Math.max(1, Math.ceil(data.length / maxLabelCount))

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Daily completion</h2>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              interval={labelEvery - 1}
              axisLine={{ stroke: 'var(--line)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--elevated)', opacity: 0.5 }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 12
              }}
              formatter={(value) => [`${Math.round(Number(value))}%`, 'Completed']}
              labelFormatter={(label) => longDate(String(label))}
            />
            <Bar dataKey="percent" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function HabitPerformance({ analytics }: { analytics: RangeAnalytics }): React.JSX.Element {
  const tracked = analytics.habits.filter((habit) => habit.scheduledDays > 0)
  if (tracked.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Per-habit performance</h2>
        <p className="mt-2 text-sm text-muted">No scheduled habits in this range.</p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Per-habit performance</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted">
              <th className="pb-2 pr-4 font-medium">Habit</th>
              <th className="pb-2 pr-4 font-medium">Completion</th>
              <th className="pb-2 pr-4 font-medium">Current streak</th>
              <th className="pb-2 pr-4 font-medium">Best</th>
              <th className="pb-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {tracked.map((habit) => {
              const rate = Math.round((habit.completedDays / habit.scheduledDays) * 100)
              return (
                <tr key={habit.habitId} className="border-t border-border/50">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: habit.color }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-foreground">{habit.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted">
                    {rate}% · {habit.completedDays}/{habit.scheduledDays}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-foreground">
                    {habit.currentStreak} day{habit.currentStreak === 1 ? '' : 's'}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted">{habit.bestStreak}</td>
                  <td className="py-2.5 tabular-nums text-muted">
                    {formatHabitTotal(habit.trackingType, habit.totalValue, habit.unit)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/**
 * GitHub-style consistency grid: one column per week, one row per weekday,
 * colored by that day's completion percent. Only days that counted are filled.
 */
function ConsistencyHeatmap({ analytics }: { analytics: RangeAnalytics }): React.JSX.Element | null {
  const days = analytics.days
  if (days.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Consistency</h2>
        <p className="mt-2 text-sm text-muted">No days in this range yet.</p>
      </Card>
    )
  }

  // Pad the front so the first day lands on its weekday row (0 = Sunday).
  const firstDay = days[0]
  if (!firstDay) return null
  const firstWeekday = new Date(firstDay.date.replace(/-/g, '/')).getDay()
  const cells: Array<{ date: string; percent: number | null } | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...days.map((day) => ({ date: day.date, percent: day.percent }))
  ]
  // Pad the end to complete the last week column.
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: Array<Array<{ date: string; percent: number | null } | null>> = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarRange className="size-4 text-muted" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-foreground">Consistency</h2>
        <span className="flex-1" />
        <HeatmapLegend />
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((cell, dayIndex) => (
              <div
                key={dayIndex}
                title={
                  cell
                    ? `${longDate(cell.date)} — ${cell.percent === null ? 'nothing scheduled' : `${Math.round(cell.percent)}% completed`}`
                    : undefined
                }
                className={cn(
                  'size-3.5 rounded-[3px]',
                  cell === null
                    ? 'bg-transparent'
                    : cell.percent === null
                      ? 'bg-elevated'
                      : heatmapColor(cell.percent)
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

function heatmapColor(percent: number): string {
  if (percent >= 100) return 'bg-primary'
  if (percent >= 66) return 'bg-primary/70'
  if (percent >= 33) return 'bg-primary/45'
  return 'bg-primary/25'
}

function HeatmapLegend(): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted">
      less
      <span className="size-3 rounded-[3px] bg-elevated" />
      <span className="size-3 rounded-[3px] bg-primary/25" />
      <span className="size-3 rounded-[3px] bg-primary/45" />
      <span className="size-3 rounded-[3px] bg-primary/70" />
      <span className="size-3 rounded-[3px] bg-primary" />
      more
    </div>
  )
}

function EmptyAnalytics(): React.JSX.Element {
  return (
    <div className="py-10 text-center">
      <ChartColumn className="mx-auto mb-3 size-8 text-muted/60" strokeWidth={1.5} />
      <h2 className="font-medium text-foreground">No tracked data in this range</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Complete or skip habits on the Today page and your charts will fill in with
        real data — unscheduled days are never counted against you.
      </p>
    </div>
  )
}

function shortDate(key: string): string {
  const date = new Date(key.replace(/-/g, '/'))
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function longDate(key: string): string {
  return new Date(key.replace(/-/g, '/')).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function formatHabitTotal(
  trackingType: string,
  totalValue: number,
  unit: string
): string {
  if (trackingType === 'duration') return formatMinutes(totalValue)
  const rounded = Math.round(totalValue * 10) / 10
  const display = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
  return unit === '' ? display : `${display} ${unit}`
}
