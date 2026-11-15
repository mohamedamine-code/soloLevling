import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import type {
  Habit,
  HabitCreateInput,
  HabitSchedule,
  HabitUpdateInput,
  ScheduleType
} from '@shared/types'
import {
  formatZodError,
  habitCreateSchema,
  habitIdSchema,
  habitUpdateSchema,
  HABIT_COLORS,
  reorderInputSchema
} from '@shared/validation/habit'
import { toLocalDateKey } from '@shared/utils/date'
import type { HabitRepository } from '../db/repositories/habit-repository'

/**
 * Habit business logic: validation, normalization, and defaults.
 * IPC handlers call this service; the repository below it is persistence-only.
 */

/** Default icon per category (lucide name); a picker comes later. */
const DEFAULT_ICONS: Record<Habit['category'], string> = {
  spiritual: 'Sparkles',
  health: 'HeartPulse',
  learning: 'BookOpen',
  productivity: 'Zap',
  personal: 'User'
}

export class HabitService {
  constructor(private readonly habits: HabitRepository) {}

  list(): Habit[] {
    return this.habits.listAll()
  }

  create(rawInput: HabitCreateInput): Habit {
    const input = parseOrThrow(habitCreateSchema, rawInput)
    const now = new Date().toISOString()
    const trackingType = input.trackingType

    const habit: Habit = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      category: input.category,
      trackingType,
      targetValue: trackingType === 'boolean' ? 1 : (input.targetValue ?? 0),
      unit: trackingType === 'boolean' ? '' : input.unit,
      icon: input.icon !== '' ? input.icon : DEFAULT_ICONS[input.category],
      color: input.color ?? HABIT_COLORS[0],
      sortOrder: this.habits.getMaxSortOrder() + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      schedule: createSchedule(input.schedule, undefined)
    }

    this.habits.insertWithSchedule(habit)
    return habit
  }

  update(id: string, rawInput: HabitUpdateInput): Habit {
    parseOrThrow(habitIdSchema, id)
    const input = parseOrThrow(habitUpdateSchema, rawInput)

    const existing = this.habits.getById(id)
    if (!existing) {
      throw new ServiceError('Habit not found')
    }

    const nextTrackingType = input.trackingType ?? existing.trackingType
    const updated: Habit = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      category: input.category ?? existing.category,
      trackingType: nextTrackingType,
      targetValue: nextTrackingType === 'boolean' ? 1 : (input.targetValue ?? existing.targetValue),
      unit: nextTrackingType === 'boolean' ? '' : (input.unit ?? existing.unit),
      icon: input.icon !== undefined && input.icon !== '' ? input.icon : existing.icon,
      color: input.color ?? existing.color,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date().toISOString(),
      schedule: createSchedule(input.schedule, existing.schedule)
    }

    this.habits.update(updated)
    return updated
  }

  archive(id: string): Habit {
    return this.setArchived(id, new Date().toISOString())
  }

  restore(id: string): Habit {
    return this.setArchived(id, null)
  }

  remove(id: string): void {
    parseOrThrow(habitIdSchema, id)
    const existing = this.habits.getById(id)
    if (!existing) {
      throw new ServiceError('Habit not found')
    }
    this.habits.delete(id)
  }

  reorder(rawOrderedIds: string[]): Habit[] {
    const { orderedIds } = parseOrThrow(reorderInputSchema, { orderedIds: rawOrderedIds })
    this.habits.reorder(orderedIds)
    return this.list()
  }

  private setArchived(id: string, archivedAt: string | null): Habit {
    parseOrThrow(habitIdSchema, id)
    const existing = this.habits.getById(id)
    if (!existing) {
      throw new ServiceError('Habit not found')
    }
    this.habits.setArchived(id, archivedAt)
    const result = this.habits.getById(id)
    if (!result) {
      throw new ServiceError('Habit not found after update')
    }
    return result
  }
}

export class ServiceError extends Error {}

/**
 * Builds a complete schedule from a (possibly partial) input and a base
 * schedule to merge with. Omitted fields fall back to the base (when updating)
 * or to defaults (when creating: daily, starting today, open-ended).
 *
 * The loose input type accepts Zod-parsed values, whose optional properties
 * may carry `undefined` (which the strict input interfaces forbid).
 */
type ScheduleInputLoose = {
  type?: ScheduleType | undefined
  weekdays?: number[] | undefined
  startDate?: string | undefined
  endDate?: string | null | undefined
}

function createSchedule(
  input: ScheduleInputLoose | undefined,
  base: HabitSchedule | undefined
): HabitSchedule {
  return {
    type: input?.type ?? base?.type ?? 'daily',
    weekdays: dedupeWeekdays(input?.weekdays ?? base?.weekdays ?? []),
    startDate: input?.startDate ?? base?.startDate ?? toLocalDateKey(),
    endDate: input?.endDate !== undefined ? input.endDate : (base?.endDate ?? null)
  }
}

function dedupeWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays)].sort((a, b) => a - b)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: any): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ServiceError(formatZodError(result.error))
  }
  return result.data
}
