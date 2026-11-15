import { z } from 'zod'
import { isLocalDateKey } from '../utils/date'

/** Validates a local YYYY-MM-DD day key crossing IPC. */
export const dateKeySchema = z
  .string()
  .refine((value) => isLocalDateKey(value), 'Invalid date')

export const habitIdSchema = z.string().uuid('Invalid habit id')

/** Non-negative finite number (quantity units, boolean values). */
export const trackingValueSchema = z
  .number()
  .finite('Value must be a number')
  .min(0, 'Value cannot be negative')
  .max(1_000_000)

/** Manual duration entry in minutes: > 0, at most a full day. */
export const durationMinutesSchema = z
  .number()
  .finite('Duration must be a number')
  .min(0.1, 'Duration must be greater than zero')
  .max(1440, 'Duration cannot exceed 24 hours')

export const quantityDeltaSchema = z
  .number()
  .finite('Step must be a number')
  .min(-1_000_000)
  .max(1_000_000)
