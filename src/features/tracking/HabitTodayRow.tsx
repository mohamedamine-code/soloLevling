import { useState } from 'react'
import { Check, CircleSlash, Pause, Play, Plus, RotateCcw, Square, Timer } from 'lucide-react'
import type { ActiveTimerSession, HabitTrackingState } from '@shared/types'
import { formatTargetProgress, quantityStep } from '@shared/domain/progress'
import { formatElapsedShort } from './TimerDisplay'
import { TimerDisplay } from './TimerDisplay'
import { useTrackingStore } from '@/stores/tracking-store'
import { HabitIcon } from '@/components/ui/HabitIcon'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'

interface HabitTodayRowProps {
  state: HabitTrackingState
  dateKey: string
  /** Global active timer session, or null. */
  activeTimer: ActiveTimerSession | null
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
  active = false,
  danger = false
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  active?: boolean
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'bg-primary text-on-primary hover:opacity-90'
          : cn(
              'text-muted hover:bg-elevated hover:text-foreground',
              danger && 'hover:bg-danger/10 hover:text-danger'
            )
      )}
    >
      {children}
    </button>
  )
}

export function HabitTodayRow({ state, dateKey, activeTimer }: HabitTodayRowProps): React.JSX.Element {
  const { habit, status, actual, skipped } = state
  const {
    complete,
    uncomplete,
    setQuantity,
    incrementQuantity,
    addDuration,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    skip,
    unskip
  } = useTrackingStore()

  const ownTimer = activeTimer?.habitId === habit.id ? activeTimer : null
  const anotherTimerActive = activeTimer !== null && activeTimer.habitId !== habit.id

  // Commit-on-blur inputs: keyed by the current value so they remount with
  // fresh defaults whenever the store value changes externally.
  const [editingValue, setEditingValue] = useState<string>('')
  const [manualLogOpen, setManualLogOpen] = useState(false)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 transition-colors',
        skipped ? 'opacity-55' : 'hover:bg-elevated/40'
      )}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${habit.color}22` }}
      >
        <HabitIcon name={habit.icon} className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-sm font-medium text-foreground', status === 'completed' && 'text-muted')}>
            {habit.name}
          </span>
          {status === 'completed' ? <Badge tone="success">Done</Badge> : null}
          {skipped ? <Badge tone="warning">Skipped</Badge> : null}
        </div>
        <div className="text-xs text-muted">
          {habit.trackingType === 'duration'
            ? formatTargetProgress(habit, actual)
            : formatTargetProgress(habit, actual)}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {skipped ? (
          <IconButton label="Undo skip" onClick={() => void unskip(habit.id, dateKey)}>
            <RotateCcw className="size-4" strokeWidth={1.75} />
          </IconButton>
        ) : (
          <TrackingControls
            habit={habit}
            status={status}
            actual={actual}
            ownTimer={ownTimer}
            anotherTimerActive={anotherTimerActive}
            editingValue={editingValue}
            setEditingValue={setEditingValue}
            manualLogOpen={manualLogOpen}
            setManualLogOpen={setManualLogOpen}
            onToggleComplete={() =>
              status === 'completed'
                ? void uncomplete(habit.id, dateKey)
                : void complete(habit.id, dateKey)
            }
            onSetQuantity={(value) => void setQuantity(habit.id, dateKey, value)}
            onIncrement={(delta) => void incrementQuantity(habit.id, dateKey, delta)}
            onLogDuration={(minutes) => void addDuration(habit.id, dateKey, minutes)}
            onStartTimer={() => void startTimer(habit.id, dateKey)}
            onPauseTimer={() => void pauseTimer(habit.id)}
            onResumeTimer={() => void resumeTimer(habit.id)}
            onStopTimer={() => void stopTimer(habit.id)}
          />
        )}
        {!skipped ? (
          <IconButton label="Skip for today" onClick={() => void skip(habit.id, dateKey)}>
            <CircleSlash className="size-4" strokeWidth={1.75} />
          </IconButton>
        ) : null}
      </div>
    </div>
  )
}

interface TrackingControlsProps {
  habit: HabitTrackingState['habit']
  status: HabitTrackingState['status']
  actual: number
  ownTimer: ActiveTimerSession | null
  anotherTimerActive: boolean
  editingValue: string
  setEditingValue: (value: string) => void
  manualLogOpen: boolean
  setManualLogOpen: (open: boolean) => void
  onToggleComplete: () => void
  onSetQuantity: (value: number) => void
  onIncrement: (delta: number) => void
  onLogDuration: (minutes: number) => void
  onStartTimer: () => void
  onPauseTimer: () => void
  onResumeTimer: () => void
  onStopTimer: () => void
}

function TrackingControls(props: TrackingControlsProps): React.JSX.Element {
  switch (props.habit.trackingType) {
    case 'boolean':
      return <BooleanControls {...props} />
    case 'quantity':
      return <QuantityControls {...props} />
    case 'duration':
      return <DurationControls {...props} />
  }
}

function BooleanControls({ status, onToggleComplete }: TrackingControlsProps): React.JSX.Element {
  return (
    <IconButton
      label={status === 'completed' ? 'Mark as not completed' : 'Mark as completed'}
      onClick={onToggleComplete}
      active={status === 'completed'}
    >
      <Check className="size-4" strokeWidth={2.25} />
    </IconButton>
  )
}

function QuantityControls({
  actual,
  editingValue,
  setEditingValue,
  onSetQuantity,
  onIncrement,
  habit
}: TrackingControlsProps): React.JSX.Element {
  const step = quantityStep(habit)
  const display = Number.isInteger(actual) ? actual.toFixed(0) : actual.toFixed(1)

  const commit = (): void => {
    const parsed = Number(editingValue)
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetQuantity(Math.round(parsed * 100) / 100)
    }
    setEditingValue('')
  }

  return (
    <div className="flex items-center gap-1">
      <IconButton label={`Subtract ${step}`} onClick={() => onIncrement(-step)} disabled={actual <= 0}>
        <span className="text-base leading-none">−</span>
      </IconButton>
      <input
        key={actual}
        type="text"
        inputMode="decimal"
        defaultValue={display}
        aria-label={`Set value for ${habit.name}`}
        onChange={(event) => setEditingValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
        className="h-8 w-16 rounded-md bg-elevated px-1 text-center text-xs tabular-nums text-foreground focus:outline-2 focus:outline-primary/60"
      />
      <IconButton label={`Add ${step}`} onClick={() => onIncrement(step)}>
        <Plus className="size-4" strokeWidth={2} />
      </IconButton>
    </div>
  )
}

function DurationControls({
  habit,
  actual,
  ownTimer,
  anotherTimerActive,
  manualLogOpen,
  setManualLogOpen,
  onLogDuration,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onStopTimer
}: TrackingControlsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {manualLogOpen ? (
        <ManualLogInput
          habit={habit}
          onClose={() => setManualLogOpen(false)}
          onLog={onLogDuration}
        />
      ) : (
        <>
          {ownTimer !== null ? (
            <TimerDisplay key={ownTimer.id + ':' + ownTimer.status} session={ownTimer} />
          ) : null}
          {ownTimer === null ? (
            <>
              <IconButton
                label={anotherTimerActive ? 'Finish the other timer first' : 'Start timer'}
                onClick={onStartTimer}
                disabled={anotherTimerActive}
              >
                <Play className="size-4" strokeWidth={2} />
              </IconButton>
              <IconButton
                label="Log minutes manually"
                onClick={() => setManualLogOpen(true)}
                disabled={anotherTimerActive}
              >
                <Timer className="size-4" strokeWidth={1.75} />
              </IconButton>
            </>
          ) : (
            <>
              <IconButton
                label={ownTimer.status === 'running' ? 'Pause timer' : 'Resume timer'}
                onClick={ownTimer.status === 'running' ? onPauseTimer : onResumeTimer}
              >
                {ownTimer.status === 'running' ? (
                  <Pause className="size-4" strokeWidth={2} />
                ) : (
                  <Play className="size-4" strokeWidth={2} />
                )}
              </IconButton>
              <IconButton label="Stop timer" onClick={onStopTimer} danger>
                <Square className="size-3.5" strokeWidth={2} />
              </IconButton>
            </>
          )}
          {ownTimer === null && actual > 0 ? (
            <span className="ml-1 text-xs tabular-nums text-muted">
              {formatElapsedShort(actual * 60)}
            </span>
          ) : null}
        </>
      )}
    </div>
  )
}

function ManualLogInput({
  habit,
  onClose,
  onLog
}: {
  habit: HabitTrackingState['habit']
  onClose: () => void
  onLog: (minutes: number) => void
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const commit = (): void => {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      onLog(Math.round(parsed * 10) / 10)
      onClose()
    }
  }
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        placeholder="min"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            onClose()
          }
        }}
        aria-label={`Log minutes for ${habit.name}`}
        className="h-8 w-14 rounded-md bg-elevated px-2 text-center text-xs tabular-nums text-foreground placeholder:text-muted/60 focus:outline-2 focus:outline-primary/60"
      />
      <IconButton label="Confirm logged minutes" onClick={commit}>
        <Check className="size-4" strokeWidth={2.25} />
      </IconButton>
    </div>
  )
}
