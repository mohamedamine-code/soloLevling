import { describe, expect, it } from 'vitest'
import { isScheduledOn, WEEKDAY_LABELS } from '@shared/domain/schedule'
import type { HabitSchedule } from '@shared/types'

function schedule(overrides: Partial<HabitSchedule> = {}): HabitSchedule {
  return {
    type: 'daily',
    weekdays: [],
    startDate: '2026-01-01',
    endDate: null,
    ...overrides
  }
}

describe('isScheduledOn', () => {
  it('daily habits are due every day inside the range', () => {
    const s = schedule()
    expect(isScheduledOn(s, '2026-11-14')).toBe(true)
    expect(isScheduledOn(s, '2030-01-01')).toBe(true)
  })

  it('respects the start date (inclusive)', () => {
    const s = schedule({ startDate: '2026-11-14' })
    expect(isScheduledOn(s, '2026-11-13')).toBe(false)
    expect(isScheduledOn(s, '2026-11-14')).toBe(true)
  })

  it('respects the end date (inclusive)', () => {
    const s = schedule({ endDate: '2026-11-14' })
    expect(isScheduledOn(s, '2026-11-14')).toBe(true)
    expect(isScheduledOn(s, '2026-11-15')).toBe(false)
  })

  it('weekday habits match only selected weekdays', () => {
    // 2026-11-14 is a Saturday (6); 2026-11-16 is a Monday (1).
    const s = schedule({ type: 'weekdays', weekdays: [1, 3, 5] })
    expect(isScheduledOn(s, '2026-11-14')).toBe(false)
    expect(isScheduledOn(s, '2026-11-16')).toBe(true) // Mon
    expect(isScheduledOn(s, '2026-11-18')).toBe(true) // Wed
    expect(isScheduledOn(s, '2026-11-17')).toBe(false) // Tue
  })

  it('weekday + range bounds combine', () => {
    const s = schedule({ type: 'weekdays', weekdays: [1], startDate: '2026-11-16', endDate: '2026-11-20' })
    expect(isScheduledOn(s, '2026-11-09')).toBe(false) // Mon but before start
    expect(isScheduledOn(s, '2026-11-16')).toBe(true) // Mon in range
    expect(isScheduledOn(s, '2026-11-23')).toBe(false) // Mon but after end
  })

  it('throws on malformed date keys', () => {
    expect(() => isScheduledOn(schedule(), 'garbage')).toThrow()
  })

  it('exposes weekday labels in order', () => {
    expect(WEEKDAY_LABELS[0]).toBe('Sun')
    expect(WEEKDAY_LABELS[6]).toBe('Sat')
  })
})
