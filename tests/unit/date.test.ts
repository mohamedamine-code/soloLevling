import { describe, expect, it } from 'vitest'
import {
  formatMinutes,
  fromLocalDateKey,
  getGreeting,
  toLocalDateKey
} from '@/utils/date'

describe('toLocalDateKey', () => {
  it('formats a midday date correctly', () => {
    const date = new Date(2026, 10, 14, 12, 30) // local time
    expect(toLocalDateKey(date)).toBe('2026-11-14')
  })

  it('pads single-digit months and days', () => {
    const date = new Date(2026, 2, 5, 23, 59)
    expect(toLocalDateKey(date)).toBe('2026-03-05')
  })

  it('uses local time, not UTC (late-night case)', () => {
    // 23:30 local must stay on the same local day even if UTC is already tomorrow.
    const date = new Date(2026, 10, 14, 23, 30)
    expect(toLocalDateKey(date)).toBe('2026-11-14')
  })
})

describe('fromLocalDateKey', () => {
  it('round-trips with toLocalDateKey', () => {
    const date = new Date(2026, 10, 14, 15, 0)
    expect(fromLocalDateKey(toLocalDateKey(date)).toDateString()).toBe(
      new Date(2026, 10, 14).toDateString()
    )
  })

  it('throws on malformed keys', () => {
    expect(() => fromLocalDateKey('2026-11-1')).toThrow()
    expect(() => fromLocalDateKey('garbage')).toThrow()
  })
})

describe('getGreeting', () => {
  it('greets by time of day', () => {
    expect(getGreeting(new Date(2026, 10, 14, 8, 0))).toBe('Good morning')
    expect(getGreeting(new Date(2026, 10, 14, 13, 0))).toBe('Good afternoon')
    expect(getGreeting(new Date(2026, 10, 14, 21, 0))).toBe('Good evening')
  })
})

describe('formatMinutes', () => {
  it('formats minutes only', () => {
    expect(formatMinutes(30)).toBe('30m')
  })
  it('formats hours only', () => {
    expect(formatMinutes(120)).toBe('2h')
  })
  it('formats mixed durations', () => {
    expect(formatMinutes(105)).toBe('1h 45m')
  })
  it('never goes negative', () => {
    expect(formatMinutes(-10)).toBe('0m')
  })
})
