import { useEffect, useState } from 'react'
import { ListChecks, Plus, Search } from 'lucide-react'
import type { Habit, HabitCategory } from '@shared/types'
import { CATEGORY_LABELS } from '@shared/constants/categories'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useHabitsStore } from '@/stores/habits-store'
import { HabitFormDialog } from './HabitFormDialog'
import { HabitRow } from './HabitRow'

export function HabitsPage(): React.JSX.Element {
  const {
    habits,
    status,
    actionError,
    load,
    archive,
    restore,
    remove,
    move,
    clearActionError
  } = useHabitsStore()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | HabitCategory>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredActive = filterHabits(habits, search, categoryFilter, false)
  const filteredArchived = showArchived
    ? filterHabits(habits, search, categoryFilter, true)
    : []

  const isFiltering = search !== '' || categoryFilter !== 'all'

  return (
    <div>
      <PageHeader
        title="My Habits"
        subtitle="Create, organize and schedule your habits."
        actions={
          <Button
            onClick={() => {
              setEditingHabit(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" strokeWidth={2} />
            New habit
          </Button>
        }
      />

      {actionError ? (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={clearActionError}
            className="text-xs underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
          <Input
            placeholder="Search habits"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            aria-label="Search habits"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as 'all' | HabitCategory)}
          aria-label="Filter by category"
          className="w-44"
        >
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as HabitCategory[]).map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <Button
          variant={showArchived ? 'secondary' : 'ghost'}
          onClick={() => setShowArchived((current) => !current)}
        >
          Archived
        </Button>
      </div>

      {status === 'loading' && habits.length === 0 ? (
        <p className="px-1 py-10 text-center text-sm text-muted">Loading habits…</p>
      ) : habits.length === 0 && status === 'ready' ? (
        <EmptyState
          icon={ListChecks}
          title="No habits yet"
          description="Create your first habit to start building consistency. Habits can be tracked as yes/no, quantities, or durations."
        >
          <Button
            onClick={() => {
              setEditingHabit(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" strokeWidth={2} />
            Create your first habit
          </Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <HabitSection
            title={isFiltering ? 'Matches' : 'Active habits'}
            count={filteredActive.length}
          >
            {filteredActive.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                No habits match your search or filter.
              </p>
            ) : (
              filteredActive.map((habit, index) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  canMoveUp={!isFiltering && index > 0}
                  canMoveDown={!isFiltering && index < filteredActive.length - 1}
                  onEdit={() => {
                    setEditingHabit(habit)
                    setFormOpen(true)
                  }}
                  onArchive={() => void archive(habit.id)}
                  onRestore={() => void restore(habit.id)}
                  onDelete={() => setDeletingHabit(habit)}
                  onMove={(direction) => void move(habit.id, direction)}
                />
              ))
            )}
          </HabitSection>

          {showArchived ? (
            <HabitSection title="Archived" count={filteredArchived.length}>
              {filteredArchived.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No archived habits.</p>
              ) : (
                filteredArchived.map((habit) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    canMoveUp={false}
                    canMoveDown={false}
                    onEdit={() => {
                      setEditingHabit(habit)
                      setFormOpen(true)
                    }}
                    onArchive={() => void archive(habit.id)}
                    onRestore={() => void restore(habit.id)}
                    onDelete={() => setDeletingHabit(habit)}
                    onMove={() => undefined}
                  />
                ))
              )}
            </HabitSection>
          ) : null}
        </div>
      )}

      {formOpen ? (
        <HabitFormDialog
          key={editingHabit?.id ?? 'new-habit'}
          editing={editingHabit}
          onClose={() => {
            setFormOpen(false)
            setEditingHabit(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deletingHabit !== null}
        title="Delete habit"
        message={`Delete "${deletingHabit?.name ?? ''}" permanently? Its daily records will also be removed when tracking is available. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeletingHabit(null)}
        onConfirm={() => {
          if (deletingHabit) void remove(deletingHabit.id)
          setDeletingHabit(null)
        }}
      />
    </div>
  )
}

function HabitSection({
  title,
  count,
  children
}: {
  title: string
  count: number
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
        {title} · {count}
      </h2>
      <div className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60 bg-surface">
        {children}
      </div>
    </section>
  )
}

function filterHabits(
  habits: Habit[],
  search: string,
  categoryFilter: 'all' | HabitCategory,
  archived: boolean
): Habit[] {
  const query = search.trim().toLowerCase()
  return habits.filter((habit) => {
    const isArchived = habit.archivedAt !== null
    if (isArchived !== archived) return false
    if (categoryFilter !== 'all' && habit.category !== categoryFilter) return false
    if (query !== '') {
      const haystack = `${habit.name} ${habit.description}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}
