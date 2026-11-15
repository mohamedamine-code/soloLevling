import { useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { DaySnapshot, Routine } from '@shared/types'
import { formatTargetProgress, quantityStep } from '@shared/domain/progress'
import { toLocalDateKey } from '@shared/utils/date'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

interface StartRoutineDialogProps {
  routine: Routine
  onClose: () => void
}

/**
 * Work through a routine for today: boolean members get a one-click complete
 * toggle, quantity members a +step button, duration members show their
 * progress (timers live on the Today page). Data comes from the same
 * DaySnapshot source of truth as the dashboard and widget.
 */
export function StartRoutineDialog({
  routine,
  onClose
}: StartRoutineDialogProps): React.JSX.Element | null {
  const todayKey = toLocalDateKey(new Date())
  const [snapshot, setSnapshot] = useState<DaySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.soloLeving.tracking
      .getDay(todayKey)
      .then((value) => {
        if (!cancelled) setSnapshot(value)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load today')
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

  const stateById = new Map((snapshot?.states ?? []).map((state) => [state.habit.id, state]))

  const act = (action: (api: typeof window.soloLeving.tracking) => Promise<DaySnapshot>): void => {
    void action(window.soloLeving.tracking).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Tracking failed')
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={routine.name}
      description="Check off each habit for today. Progress syncs everywhere instantly."
    >
      {error ? (
        <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {routine.habits.map((habit) => {
          const state = stateById.get(habit.id)
          const status = state?.status ?? 'pending'
          const actual = state?.actual ?? 0

          return (
            <div
              key={habit.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5',
                status === 'completed' && 'bg-primary/5',
                status === 'skipped' && 'opacity-60'
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: habit.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{habit.name}</div>
                <div className="text-xs text-muted">
                  {status === 'skipped'
                    ? 'Skipped for today'
                    : formatTargetProgress(habit, actual)}
                </div>
              </div>

              {status === 'skipped' ? null : habit.trackingType === 'boolean' ? (
                <Button
                  size="sm"
                  variant={status === 'completed' ? 'secondary' : 'primary'}
                  onClick={() =>
                    act((api) =>
                      status === 'completed'
                        ? api.uncomplete(habit.id, todayKey)
                        : api.complete(habit.id, todayKey)
                    )
                  }
                >
                  <Check className="size-3.5" strokeWidth={2.25} />
                  {status === 'completed' ? 'Done' : 'Complete'}
                </Button>
              ) : habit.trackingType === 'quantity' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    act((api) => api.incrementQuantity(habit.id, todayKey, quantityStep(habit)))
                  }
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                  Add {quantityStep(habit)}
                </Button>
              ) : (
                <span className="shrink-0 text-xs text-muted">Track on Today</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  )
}
