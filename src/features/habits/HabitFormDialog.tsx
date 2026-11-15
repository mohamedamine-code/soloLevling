import { useState } from 'react'
import type { Habit, HabitCategory, HabitCreateInput, HabitUpdateInput, ScheduleType, TrackingType } from '@shared/types'
import { CATEGORY_LABELS } from '@shared/constants/categories'
import { HABIT_COLORS, habitCreateSchema, habitUpdateSchema } from '@shared/validation/habit'
import { WEEKDAY_LABELS } from '@shared/domain/schedule'
import { toLocalDateKey } from '@shared/utils/date'
import { useHabitsStore } from '@/stores/habits-store'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Segmented, Select, Textarea } from '@/components/ui/Form'
import { cn } from '@/utils/cn'

interface HabitFormDialogProps {
  /** When set, the dialog edits this habit; otherwise it creates a new one. */
  editing: Habit | null
  onClose: () => void
}

interface FormState {
  name: string
  description: string
  category: HabitCategory
  trackingType: TrackingType
  targetValue: string
  unit: string
  scheduleType: ScheduleType
  weekdays: number[]
  startDate: string
  endDate: string
  color: string
}

function initialForm(editing: Habit | null): FormState {
  if (editing) {
    return {
      name: editing.name,
      description: editing.description,
      category: editing.category,
      trackingType: editing.trackingType,
      targetValue: String(editing.targetValue),
      unit: editing.unit,
      scheduleType: editing.schedule.type,
      weekdays: [...editing.schedule.weekdays],
      startDate: editing.schedule.startDate,
      endDate: editing.schedule.endDate ?? '',
      color: editing.color
    }
  }
  return {
    name: '',
    description: '',
    category: 'personal',
    trackingType: 'boolean',
    targetValue: '1',
    unit: '',
    scheduleType: 'daily',
    weekdays: [1, 2, 3, 4, 5],
    startDate: toLocalDateKey(),
    endDate: '',
    color: HABIT_COLORS[0]
  }
}

const TRACKING_OPTIONS = [
  { value: 'boolean' as TrackingType, label: 'Yes / No', description: 'Completed or not' },
  {
    value: 'quantity' as TrackingType,
    label: 'Quantity',
    description: 'e.g. 50 push-ups, 20 pages'
  },
  {
    value: 'duration' as TrackingType,
    label: 'Duration',
    description: 'e.g. 30 minutes of reading'
  }
]

/**
 * The dialog is mounted only while open (see HabitsPage), so local state is
 * initialized once per open — no effect-based resets needed.
 */
export function HabitFormDialog({ editing, onClose }: HabitFormDialogProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>(() => initialForm(editing))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const create = useHabitsStore((state) => state.create)
  const update = useHabitsStore((state) => state.update)
  const formError = useHabitsStore((state) => state.formError)
  const clearFormError = useHabitsStore((state) => state.clearFormError)

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const isBoolean = form.trackingType === 'boolean'

  async function handleSubmit(): Promise<void> {
    const targetValue = isBoolean ? undefined : Number(form.targetValue)
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      trackingType: form.trackingType,
      ...(isBoolean ? {} : { targetValue, unit: form.unit }),
      color: form.color as (typeof HABIT_COLORS)[number],
      schedule: {
        type: form.scheduleType,
        weekdays: form.scheduleType === 'weekdays' ? form.weekdays : [],
        startDate: form.startDate,
        endDate: form.endDate === '' ? null : form.endDate
      }
    }

    const schema = editing ? habitUpdateSchema : habitCreateSchema
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setValidationError(null)
    setSubmitting(true)
    clearFormError()

    const result = editing
      ? await update(editing.id, parsed.data as HabitUpdateInput)
      : await create(parsed.data as HabitCreateInput)

    setSubmitting(false)
    if (result) onClose()
  }

  const shownError = validationError ?? formError

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'Edit habit' : 'New habit'}
      description={editing ? 'Update the details of this habit.' : 'Define what you want to do consistently.'}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <Field label="Name">
          <Input
            autoFocus
            placeholder="e.g. Read Quran, 50 push-ups, Study 30 minutes"
            value={form.name}
            maxLength={100}
            onChange={(event) => patch('name', event.target.value)}
          />
        </Field>

        <Field label="Description" hint="optional">
          <Textarea
            placeholder="Why does this habit matter to you?"
            value={form.description}
            maxLength={500}
            onChange={(event) => patch('description', event.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(event) => patch('category', event.target.value as HabitCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as HabitCategory[]).map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Color">
            <div className="flex h-10 items-center gap-2">
              {HABIT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Color ${color}`}
                  aria-pressed={form.color === color}
                  onClick={() => patch('color', color)}
                  className={cn(
                    'size-6 rounded-full transition-transform',
                    form.color === color
                      ? 'scale-110 ring-2 ring-foreground/50 ring-offset-2 ring-offset-surface'
                      : 'opacity-80 hover:opacity-100'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </Field>
        </div>

        <Field label="Tracking type">
          <Segmented
            value={form.trackingType}
            options={TRACKING_OPTIONS}
            onChange={(value) => patch('trackingType', value)}
          />
        </Field>

        {!isBoolean ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Daily target">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder={form.trackingType === 'duration' ? '30 (minutes)' : '50'}
                value={form.targetValue}
                onChange={(event) => patch('targetValue', event.target.value)}
              />
            </Field>
            <Field label="Unit">
              <Input
                placeholder={form.trackingType === 'duration' ? 'minutes' : 'reps, pages, liters…'}
                value={form.unit}
                maxLength={20}
                onChange={(event) => patch('unit', event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        <Field label="Schedule">
          <Segmented
            value={form.scheduleType}
            options={[
              { value: 'daily' as ScheduleType, label: 'Every day' },
              { value: 'weekdays' as ScheduleType, label: 'Selected weekdays' }
            ]}
            onChange={(value) => patch('scheduleType', value)}
          />
        </Field>

        {form.scheduleType === 'weekdays' ? (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, index) => {
              const selected = form.weekdays.includes(index)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    patch(
                      'weekdays',
                      selected
                        ? form.weekdays.filter((value) => value !== index)
                        : [...form.weekdays, index]
                    )
                  }
                  className={cn(
                    'h-8 w-11 rounded-lg border text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border bg-transparent text-muted hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts on">
            <Input
              type="date"
              value={form.startDate}
              onChange={(event) => patch('startDate', event.target.value)}
            />
          </Field>
          <Field label="Ends on" hint="empty = open-ended">
            <Input
              type="date"
              value={form.endDate}
              onChange={(event) => patch('endDate', event.target.value)}
            />
          </Field>
        </div>

        {shownError ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {shownError}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create habit'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
