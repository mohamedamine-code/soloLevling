import { describe, expect, it } from 'vitest'
import { computeHabitStreaks, computeOverallStreaks } from '@shared/domain/streaks'
import type { HabitSchedule } from '@shared/types'

const daily: HabitSchedule = { type: 'daily', weekdays: [], startDate: '2026-01-01', endDate: null }

describe('computeOverallStreaks', () => {
  const today = '2026-01-10'
  const earliest = '2026-01-01'

  it('counts consecutive complete days', () => {
    const summaries = [
      { date: '2026-01-08', scheduledCount: 2, completedCount: 2 },
      { date: '2026-01-09', scheduledCount: 2, completedCount: 2 }
    ]
    expect(computeOverallStreaks(summaries, today, earliest).current).toBe(2)
  })

  it('a missed scheduled day breaks the streak', () => {
    const summaries = [
      { date: '2026-01-08', scheduledCount: 2, completedCount: 2 },
      { date: '2026-01-09', scheduledCount: 2, completedCount: 0 }
    ]
    expect(computeOverallStreaks(summaries, today, earliest).current).toBe(0)
  })

  it('days with nothing scheduled neither count nor break', () => {
    const summaries = [
      { date: '2026-01-07', scheduledCount: 1, completedCount: 1 },
      { date: '2026-01-08', scheduledCount: 0, completedCount: 0 },
      { date: '2026-01-09', scheduledCount: 1, completedCount: 1 }
    ]
    expect(computeOverallStreaks(summaries, today, earliest).current).toBe(2)
  })

  it('today scheduled but incomplete does not break the current streak', () => {
    const summaries = [
      { date: '2026-01-08', scheduledCount: 1, completedCount: 1 },
      { date: '2026-01-09', scheduledCount: 1, completedCount: 1 },
      { date: today, scheduledCount: 1, completedCount: 0 } // today, still in progress
    ]
    expect(computeOverallStreaks(summaries, today, earliest).current).toBe(2)
  })

  it('best streak survives later misses', () => {
    const summaries = [
      { date: '2026-01-01', scheduledCount: 1, completedCount: 1 },
      { date: '2026-01-02', scheduledCount: 1, completedCount: 1 },
      { date: '2026-01-03', scheduledCount: 1, completedCount: 1 },
      { date: '2026-01-04', scheduledCount: 1, completedCount: 0 },
      { date: '2026-01-05', scheduledCount: 1, completedCount: 1 }
    ]
    const result = computeOverallStreaks(summaries, '2026-01-05', '2026-01-01')
    expect(result.best).toBe(3)
    expect(result.current).toBe(1)
  })
})

describe('computeHabitStreaks', () => {
  const today = '2026-01-10'

  it('respects scheduled days, not calendar days', () => {
    // Weekdays = Mon only; 2026-01-05 and 2026-01-12 are Mondays.
    const schedule: HabitSchedule = {
      type: 'weekdays',
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: null
    }
    const result = computeHabitStreaks({
      schedule,
      skippedDates: [],
      completedDates: ['2026-01-05', '2026-01-12'],
      todayKey: '2026-01-14' // Wednesday
    })
    // Scheduled Mondays 01-05 and 01-12 both complete; the days between are
    // unscheduled (neither count nor break) → current 2, best 2.
    expect(result.current).toBe(2)
    expect(result.best).toBe(2)
  })

  it('skipped days pause the streak', () => {
    const result = computeHabitStreaks({
      schedule: daily,
      skippedDates: ['2026-01-08'],
      completedDates: ['2026-01-06', '2026-01-07', '2026-01-09'],
      todayKey: today
    })
    // 06 ✓, 07 ✓, 08 skipped (pause), 09 ✓, 10 today not completed (no break)
    expect(result.current).toBe(3)
    expect(result.best).toBe(3)
  })

  it('a missed scheduled day breaks the current streak', () => {
    const result = computeHabitStreaks({
      schedule: daily,
      skippedDates: [],
      completedDates: ['2026-01-06', '2026-01-07'],
      todayKey: today
    })
    // 08 and 09 missed → break
    expect(result.current).toBe(0)
    expect(result.best).toBe(2)
  })

  it('unscheduled days before start date are ignored', () => {
    const result = computeHabitStreaks({
      schedule: { ...daily, startDate: '2026-01-06' },
      skippedDates: [],
      completedDates: ['2026-01-06', '2026-01-07', '2026-01-08'],
      todayKey: '2026-01-08'
    })
    expect(result.current).toBe(3)
    expect(result.best).toBe(3)
  })
})
