import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { Routine } from '@shared/types'
import { CATEGORY_LABELS } from '@shared/constants/categories'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Form'
import { useHabitsStore } from '@/stores/habits-store'
import { useRoutinesStore } from '@/stores/routines-store'
import { cn } from '@/utils/cn'

interface RoutineFormDialogProps {
  /** Editing target, or null to create. */
  routine: Routine | null
  onClose: () => void
}

const MAX_MEMBERS = 50

/**
 * Create/edit a routine: name, description, and an ordered checklist of
 * active habits. Order = check order (members persist in checked order).
 * Mounted with a key per target (see RoutinesPage) so state initializes
 * from props — no setState-in-effect reset needed.
 */
export function RoutineFormDialog({
  routine,
  onClose
}: RoutineFormDialogProps): React.JSX.Element {
  const { habits, status: habitsStatus, load } = useHabitsStore()
  const { create, update } = useRoutinesStore()

  const [name, setName] = useState(routine?.name ?? '')
  const [description, setDescription] = useState(routine?.description ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>(
    routine?.habits.map((habit) => habit.id) ?? []
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  const activeHabits = habits.filter((habit) => habit.archivedAt === null)

  const toggleMember = (habitId: string): void => {
    setSelectedIds((current) => {
      if (current.includes(habitId)) {
        return current.filter((id) => id !== habitId)
      }
      if (current.length >= MAX_MEMBERS) {
        setFormError(`A routine can include at most ${MAX_MEMBERS} habits`)
        return current
      }
      return [...current, habitId]
    })
  }

  const save = async (): Promise<void> => {
    setFormError(null)
    if (name.trim().length === 0) {
      setFormError('Name is required')
      return
    }
    setSaving(true)
    const result = routine
      ? await update(routine.id, { name, description, habitIds: selectedIds })
      : await create({ name, description, habitIds: selectedIds })
    setSaving(false)
    if (result) {
      onClose()
    } else {
      setFormError('Could not save the routine — check your input and try again')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={routine ? 'Edit routine' : 'New routine'}
      description="A routine bundles existing habits so you can check them off together."
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Morning routine"
            maxLength={80}
            autoFocus
          />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this routine is for…"
            maxLength={300}
            rows={2}
          />
        </Field>

        <Field label={`Habits (${selectedIds.length} selected)`}>
          {activeHabits.length === 0 && habitsStatus === 'ready' ? (
            <p className="rounded-lg bg-elevated px-3 py-2.5 text-sm text-muted">
              No active habits — create habits in My Habits first.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border/60">
              {activeHabits.map((habit) => {
                const checked = selectedIds.includes(habit.id)
                return (
                  <button
                    key={habit.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleMember(habit.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      'border-b border-border/40 last:border-b-0 hover:bg-elevated/60',
                      checked && 'bg-primary/5'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors',
                        checked ? 'border-primary bg-primary text-on-primary' : 'border-border'
                      )}
                    >
                      {checked ? <Check className="size-3" strokeWidth={2.5} /> : null}
                    </span>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: habit.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {habit.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {CATEGORY_LABELS[habit.category]}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Field>

        {formError ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || name.trim().length === 0}>
            {routine ? 'Save changes' : 'Create routine'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
