import { useEffect, useState } from 'react'
import { Play, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import type { Routine } from '@shared/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useRoutinesStore } from '@/stores/routines-store'
import { RoutineFormDialog } from './RoutineFormDialog'
import { StartRoutineDialog } from './StartRoutineDialog'

/**
 * Routines: reusable ordered groups of existing habits. Members resolve to
 * live habit data, so archived/deleted habits never appear in a routine.
 */
export function RoutinesPage(): React.JSX.Element {
  const { routines, status, error, load, clearError, remove } = useRoutinesStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Routine | null>(null)
  const [starting, setStarting] = useState<Routine | null>(null)
  const [deleting, setDeleting] = useState<Routine | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Routines"
        subtitle="Reusable groups of habits — check off a whole routine from one place."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" strokeWidth={2} />
            New routine
          </Button>
        }
      />

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

      {status === 'loading' && routines.length === 0 ? (
        <p className="px-1 py-10 text-center text-sm text-muted">Loading routines…</p>
      ) : routines.length === 0 && status === 'ready' ? (
        <EmptyState
          icon={Repeat}
          title="No routines yet"
          description="Create a routine to bundle habits like “Morning” or “Evening wind-down” and check them off together."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {routines.map((routine) => (
            <Card key={routine.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                  <Repeat className="size-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-foreground">{routine.name}</h2>
                  {routine.description ? (
                    <p className="mt-0.5 text-sm text-muted">{routine.description}</p>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {routine.habits.map((habit) => (
                      <span
                        key={habit.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-xs text-muted"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: habit.color }}
                          aria-hidden="true"
                        />
                        {habit.name}
                      </span>
                    ))}
                    {routine.habits.length === 0 ? (
                      <span className="text-xs italic text-muted">Empty routine — edit to add habits</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" onClick={() => setStarting(routine)}>
                    <Play className="size-3.5" strokeWidth={2} />
                    Start
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${routine.name}`}
                    title="Edit routine"
                    onClick={() => {
                      setEditing(routine)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="size-3.5" strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${routine.name}`}
                    title="Delete routine"
                    onClick={() => setDeleting(routine)}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen ? (
        <RoutineFormDialog
          key={editing?.id ?? 'new'}
          routine={editing}
          onClose={() => setFormOpen(false)}
        />
      ) : null}

      {starting ? (
        <StartRoutineDialog
          routine={starting}
          onClose={() => setStarting(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete routine"
        message={`Delete “${deleting?.name ?? ''}”? Your habits are not affected — only this routine is removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const target = deleting
          setDeleting(null)
          if (target) void remove(target.id)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
