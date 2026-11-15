import { z } from 'zod'
import type { Routine } from '@shared/types'
import {
  routineCreateSchema,
  routineHabitIdsSchema,
  routineNameSchema,
  routineDescriptionSchema,
  routineUpdateSchema
} from '@shared/validation/routine'
import type { HabitRepository } from '../db/repositories/habit-repository'
import type { RoutineRepository } from '../db/repositories/routine-repository'
import { ServiceError } from './habit-service'

/**
 * Routine business logic: reusable ordered groups of existing habits.
 * Routines never track anything themselves — they reference habit ids and
 * resolve to live Habit objects on read.
 */
export class RoutineService {
  constructor(
    private readonly habits: HabitRepository,
    private readonly routines: RoutineRepository
  ) {}

  list(): Routine[] {
    return this.routines.list()
  }

  create(rawInput: unknown): Routine {
    const input = parseOrThrow(routineCreateSchema, rawInput)
    const name = input.name
    const description = input.description ?? ''
    const habitIds = this.validateMembers(input.habitIds)
    return this.routines.create(name, description, habitIds)
  }

  update(rawId: string, rawInput: unknown): Routine {
    const id = parseOrThrow(z.string().uuid(), rawId)
    const existing = this.routines.getById(id)
    if (!existing) {
      throw new ServiceError('Routine not found')
    }

    const input = parseOrThrow(routineUpdateSchema, rawInput)

    const fields: { name?: string; description?: string; habitIds?: string[] } = {}
    if (input.name !== undefined) {
      // Re-run the stricter schema (it already validated shape; trim applied).
      fields.name = parseOrThrow(routineNameSchema, input.name)
    }
    if (input.description !== undefined) {
      fields.description = parseOrThrow(routineDescriptionSchema, input.description)
    }
    if (input.habitIds !== undefined) {
      fields.habitIds = this.validateMembers(
        parseOrThrow(routineHabitIdsSchema, input.habitIds)
      )
    }
    return this.routines.update(id, fields)
  }

  delete(rawId: string): void {
    const id = parseOrThrow(z.string().uuid(), rawId)
    if (!this.routines.getById(id)) {
      throw new ServiceError('Routine not found')
    }
    this.routines.delete(id)
  }

  /** Members must exist, be non-duplicates, and (for sanity) be active habits. */
  private validateMembers(habitIds: string[]): string[] {
    const seen = new Set<string>()
    for (const habitId of habitIds) {
      if (seen.has(habitId)) {
        throw new ServiceError('Duplicate habit in routine')
      }
      seen.add(habitId)
      const habit = this.habits.getById(habitId)
      if (!habit) {
        throw new ServiceError('One of the selected habits no longer exists')
      }
      if (habit.archivedAt !== null) {
        throw new ServiceError('Archived habits cannot be added to a routine')
      }
    }
    return habitIds
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: any): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ServiceError(result.error.issues[0]?.message ?? 'Invalid input')
  }
  return result.data
}
