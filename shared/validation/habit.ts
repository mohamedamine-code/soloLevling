import { z } from 'zod'
import { isLocalDateKey } from '../utils/date'
import type { HabitCategory, TrackingType } from '../types'

/** Canonical category list — UI pickers and DB checks use the same values. */
export const HABIT_CATEGORIES = [
  'spiritual',
  'health',
  'learning',
  'productivity',
  'personal'
] as const satisfies readonly HabitCategory[]

export const TRACKING_TYPES = ['boolean', 'quantity', 'duration'] as const satisfies readonly TrackingType[]

export const SCHEDULE_TYPES = ['daily', 'weekdays'] as const

/** Fixed palette keeps the UI consistent; stored as hex strings. */
export const HABIT_COLORS = [
  '#32B77A',
  '#5EA9F5',
  '#F5A524',
  '#E5484F',
  '#9B8AFB',
  '#F26DB6'
] as const

const localDateKey = z
  .string()
  .refine((value) => isLocalDateKey(value), 'Use the YYYY-MM-DD date format')

export const habitScheduleInputSchema = z
  .object({
    type: z.enum(SCHEDULE_TYPES).optional(),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .optional(),
    startDate: localDateKey.optional(),
    endDate: localDateKey.nullable().optional()
  })
  .refine(
    (schedule) => schedule.type !== 'weekdays' || (schedule.weekdays?.length ?? 0) > 0,
    'Select at least one weekday'
  )
  .refine(
    (schedule) =>
      !schedule.startDate || !schedule.endDate || schedule.startDate <= schedule.endDate,
    'The end date must be on or after the start date'
  )

export const habitCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the habit a name').max(100),
    description: z.string().trim().max(500).optional().default(''),
    category: z.enum(HABIT_CATEGORIES),
    trackingType: z.enum(TRACKING_TYPES),
    targetValue: z.number().positive('The target must be greater than zero').optional(),
    unit: z.string().trim().max(20).optional().default(''),
    icon: z.string().trim().max(40).optional().default(''),
    color: z.enum(HABIT_COLORS).optional(),
    schedule: habitScheduleInputSchema.optional()
  })
  .refine(
    (input) =>
      input.trackingType === 'boolean' ||
      (input.targetValue !== undefined && input.targetValue > 0),
    'Set a daily target greater than zero'
  )

export const habitUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the habit a name').max(100).optional(),
    description: z.string().trim().max(500).optional(),
    category: z.enum(HABIT_CATEGORIES).optional(),
    trackingType: z.enum(TRACKING_TYPES).optional(),
    targetValue: z.number().positive('The target must be greater than zero').optional(),
    unit: z.string().trim().max(20).optional(),
    icon: z.string().trim().max(40).optional(),
    color: z.enum(HABIT_COLORS).optional(),
    isActive: z.boolean().optional(),
    schedule: habitScheduleInputSchema.optional()
  })
  .refine(
    (input) =>
      input.trackingType === undefined ||
      input.trackingType === 'boolean' ||
      (input.targetValue !== undefined && input.targetValue > 0),
    'Set a daily target greater than zero'
  )

export const habitIdSchema = z.string().uuid('Invalid habit id')

export const reorderInputSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1)
})

export type HabitCreateParsed = z.infer<typeof habitCreateSchema>
export type HabitUpdateParsed = z.infer<typeof habitUpdateSchema>

/** Formats a ZodError as a short, user-presentable message. */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return 'Invalid input'
  return first.message
}
