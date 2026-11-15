import { describe, expect, it } from 'vitest'
import {
  computeDayProgress,
  habitActualValue,
  habitDayStatus,
  habitProgress,
  isHabitCountedOn,
  quantityStep
} from '@shared/domain/progress'
import type { Habit, HabitEntry } from '@shared/types'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test',
    description: '',
    category: 'personal',
    trackingType: 'boolean',
    targetValue: 1,
    unit: '',
    icon: '',
    color: '#32B77A',
    sortOrder: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    schedule: { type: 'daily', weekdays: [], startDate: '2026-01-01', endDate: null },
    ...overrides
  }
}

function entry(overrides: Partial<HabitEntry> = {}): HabitEntry {
  return {
    id: '00000000-0000-0000-0000-000000000002',
    habitId: '00000000-0000-0000-0000-000000000001',
    date: '2026-11-14',
    type: 'quantity',
    value: 1,
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...overrides
  }
}

describe('habitActualValue', () => {
  it('boolean habits: any entry counts as 1, never a sum', () => {
    const h = habit()
    expect(habitActualValue(h, [entry({ type: 'boolean', value: 1 })])).toBe(1)
    expect(habitActualValue(h, [])).toBe(0)
  })

  it('quantity habits: sums multiple entries', () => {
    const h = habit({ trackingType: 'quantity', targetValue: 50 })
    expect(habitActualValue(h, [entry({ value: 20 }), entry({ value: 15 })])).toBe(35)
  })

  it('duration habits: sums session minutes', () => {
    const h = habit({ trackingType: 'duration', targetValue: 60, unit: 'minutes' })
    expect(habitActualValue(h, [entry({ type: 'duration', value: 20 }), entry({ type: 'duration', value: 25 })])).toBe(45)
  })

  it('ignores entries of other habits', () => {
    const h = habit({ trackingType: 'quantity', targetValue: 50 })
    expect(habitActualValue(h, [entry({ habitId: 'other' })])).toBe(0)
  })
})

describe('habitProgress', () => {
  it('boolean: 0 or 1', () => {
    expect(habitProgress(habit(), 0)).toBe(0)
    expect(habitProgress(habit(), 1)).toBe(1)
  })

  it('partial progress', () => {
    const h = habit({ trackingType: 'quantity', targetValue: 50 })
    expect(habitProgress(h, 35)).toBe(0.7)
  })

  it('never exceeds 1 even when over target', () => {
    const h = habit({ trackingType: 'quantity', targetValue: 50 })
    expect(habitProgress(h, 120)).toBe(1)
  })

  it('duration partial', () => {
    const h = habit({ trackingType: 'duration', targetValue: 60 })
    expect(habitProgress(h, 30)).toBe(0.5)
  })
})

describe('computeDayProgress', () => {
  it('aggregates partial progress', () => {
    // Example from the spec: 100%, 50%, 100%, 50% → 75%
    const result = computeDayProgress([
      { progress: 1 },
      { progress: 0.5 },
      { progress: 1 },
      { progress: 0.5 }
    ])
    expect(result.percent).toBe(75)
    expect(result.completedCount).toBe(2)
    expect(result.includedCount).toBe(4)
  })

  it('returns null percent when nothing is included (not misleading 0%)', () => {
    const result = computeDayProgress([])
    expect(result.percent).toBeNull()
    expect(result.includedCount).toBe(0)
  })

  it('rounds to one decimal', () => {
    const result = computeDayProgress([{ progress: 1 }, { progress: 0 }, { progress: 1 }])
    expect(result.percent).toBe(66.7)
  })
})

describe('habitDayStatus', () => {
  const h = habit({ trackingType: 'quantity', targetValue: 50 })
  it('pending, in_progress, completed', () => {
    expect(habitDayStatus(h, 0, false)).toBe('pending')
    expect(habitDayStatus(h, 35, false)).toBe('in_progress')
    expect(habitDayStatus(h, 50, false)).toBe('completed')
    expect(habitDayStatus(h, 50, false)).toBe('completed')
  })

  it('skipped wins over everything', () => {
    expect(habitDayStatus(h, 50, true)).toBe('skipped')
    expect(habitDayStatus(h, 0, true)).toBe('skipped')
  })
})

describe('isHabitCountedOn', () => {
  it('excludes archived habits and unscheduled days', () => {
    expect(isHabitCountedOn(habit(), '2026-11-14')).toBe(true)
    expect(isHabitCountedOn(habit({ archivedAt: '2026-11-01T00:00:00.000Z' }), '2026-11-14')).toBe(false)
    expect(
      isHabitCountedOn(
        habit({ schedule: { type: 'weekdays', weekdays: [1], startDate: '2026-01-01', endDate: null } }),
        '2026-11-14' // Saturday
      )
    ).toBe(false)
    expect(
      isHabitCountedOn(
        habit({ schedule: { type: 'daily', weekdays: [], startDate: '2026-12-01', endDate: null } }),
        '2026-11-14' // before start
      )
    ).toBe(false)
  })
})

describe('quantityStep', () => {
  it('uses 1 for small targets', () => {
    expect(quantityStep(habit({ trackingType: 'quantity', targetValue: 20 }))).toBe(1)
  })
  it('uses target/10 for large targets', () => {
    expect(quantityStep(habit({ trackingType: 'quantity', targetValue: 50 }))).toBe(5)
    expect(quantityStep(habit({ trackingType: 'quantity', targetValue: 3 }))).toBe(1)
  })
})
