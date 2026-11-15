import { Flame } from 'lucide-react'
import type { DayProgress, OverallStreak } from '@shared/types'
import { CircularProgress } from '@/components/ui/CircularProgress'
import { Badge } from '@/components/ui/Badge'

interface DaySummaryCardProps {
  progress: DayProgress
  streak: OverallStreak
}

export function DaySummaryCard({ progress, streak }: DaySummaryCardProps): React.JSX.Element {
  const remaining = Math.max(0, progress.includedCount - progress.completedCount)
  const percentDisplay = progress.percent === null ? null : Math.round(progress.percent)

  return (
    <div className="flex items-center gap-6">
      <CircularProgress value={progress.percent ?? 0} size={96} strokeWidth={8}>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {percentDisplay === null ? '–' : `${percentDisplay}%`}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted">today</span>
      </CircularProgress>

      <div className="min-w-0 flex-1">
        <h2 className="font-medium text-foreground">Today's progress</h2>
        {percentDisplay === null ? (
          <p className="mt-0.5 text-sm text-muted">
            Nothing to complete today — skipped habits don't count against you.
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-medium text-foreground">{progress.completedCount}</span> of{' '}
            <span className="font-medium text-foreground">{progress.includedCount}</span> habits
            {remaining > 0 ? ` · ${remaining} remaining` : ' · all done'}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={streak.current > 0 ? 'success' : 'muted'}>
            <Flame className="mr-1 size-3" strokeWidth={2} />
            {streak.current} day{streak.current === 1 ? '' : 's'} streak
          </Badge>
          {streak.best > streak.current ? <Badge tone="muted">Best {streak.best}</Badge> : null}
        </div>
      </div>
    </div>
  )
}
