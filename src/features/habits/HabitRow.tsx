import type { LucideIcon } from 'lucide-react'
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import type { Habit } from '@shared/types'
import { WEEKDAY_LABELS } from '@shared/domain/schedule'
import { formatMinutes } from '@shared/utils/date'
import { HabitIcon } from '@/components/ui/HabitIcon'
import { cn } from '@/utils/cn'

interface HabitRowProps {
  habit: Habit
  canMoveUp: boolean
  canMoveDown: boolean
  onEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
  onMove: (direction: 'up' | 'down') => void
}

function describeSchedule(habit: Habit): string {
  const { schedule } = habit
  const parts: string[] = []
  if (schedule.type === 'daily') {
    parts.push('Every day')
  } else {
    const days = schedule.weekdays.map((weekday) => WEEKDAY_LABELS[weekday]).join(', ')
    parts.push(days === '' ? 'No days selected' : days)
  }
  if (schedule.endDate !== null) {
    parts.push(`until ${schedule.endDate}`)
  }
  return parts.join(' · ')
}

function describeTarget(habit: Habit): string {
  if (habit.trackingType === 'boolean') return 'Completed or not'
  const target = habit.targetValue % 1 === 0 ? habit.targetValue.toFixed(0) : habit.targetValue.toFixed(1)
  if (habit.trackingType === 'duration') return `${formatMinutes(habit.targetValue)} per day`
  return `${target} ${habit.unit}`.trim()
}

export function HabitRow({
  habit,
  canMoveUp,
  canMoveDown,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onMove
}: HabitRowProps): React.JSX.Element {
  const isArchived = habit.archivedAt !== null

  return (
    <div
      className={cn(
        'group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-elevated/40',
        isArchived && 'opacity-60'
      )}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${habit.color}22` }}
      >
        <HabitIcon name={habit.icon} className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className={cn('truncate text-sm font-medium text-foreground', isArchived && 'line-through')}>
            {habit.name}
          </h3>
          {isArchived ? <span className="text-xs text-muted">archived</span> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {describeTarget(habit)} · {describeSchedule(habit)}
        </p>
        {habit.description !== '' ? (
          <p className="mt-0.5 truncate text-xs text-muted/80">{habit.description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <RowButton
          label="Move up"
          icon={ChevronUp}
          disabled={!canMoveUp}
          onClick={() => onMove('up')}
        />
        <RowButton
          label="Move down"
          icon={ChevronDown}
          disabled={!canMoveDown}
          onClick={() => onMove('down')}
        />
        <RowButton label="Edit habit" icon={Pencil} onClick={onEdit} />
        {isArchived ? (
          <RowButton label="Restore habit" icon={ArchiveRestore} onClick={onRestore} />
        ) : (
          <RowButton label="Archive habit" icon={Archive} onClick={onArchive} />
        )}
        <RowButton label="Delete habit" icon={Trash2} onClick={onDelete} danger />
      </div>
    </div>
  )
}

function RowButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  danger = false
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
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
        'flex size-8 items-center justify-center rounded-lg text-muted transition-colors',
        'hover:bg-elevated hover:text-foreground',
        danger && 'hover:bg-danger/10 hover:text-danger',
        disabled && 'invisible cursor-default'
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  )
}
