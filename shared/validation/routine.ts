import { z } from 'zod'

/** Routine name: trimmed, 1–80 chars (enforced in the service). */
export const routineNameSchema = z.string().trim().min(1, 'Name is required').max(80)

export const routineDescriptionSchema = z.string().trim().max(300)

/** Ordered member habit ids; uniqueness is enforced in the service. */
export const routineHabitIdsSchema = z.array(z.string().uuid('Invalid habit id')).max(50)

export const routineCreateSchema = z.object({
  name: routineNameSchema,
  description: routineDescriptionSchema.optional(),
  habitIds: routineHabitIdsSchema
})

export const routineUpdateSchema = z.object({
  name: routineNameSchema.optional(),
  description: routineDescriptionSchema.optional(),
  habitIds: routineHabitIdsSchema.optional()
})
