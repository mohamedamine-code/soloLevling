import { describe, expect, it } from 'vitest'
import {
  clampPointToRect,
  parseStoredPosition,
  serializePosition
} from '../../electron/main/windows/widget-position'

describe('clampPointToRect', () => {
  const bounds = { x: 0, y: 0, width: 1920, height: 1040 }
  const size = { width: 300, height: 372 }

  it('keeps a point already inside the bounds', () => {
    expect(clampPointToRect({ x: 100, y: 100 }, size, bounds)).toEqual({ x: 100, y: 100 })
  })

  it('pulls a point right of the bounds back inside', () => {
    const result = clampPointToRect({ x: 2500, y: 100 }, size, bounds)
    expect(result.x).toBe(1920 - 300)
    expect(result.y).toBe(100)
  })

  it('pulls a point below the bounds back inside', () => {
    const result = clampPointToRect({ x: 100, y: 5000 }, size, bounds)
    expect(result.x).toBe(100)
    expect(result.y).toBe(1040 - 372)
  })

  it('respects a non-zero work-area origin (taskbar on the left/top)', () => {
    const offset = { x: 100, y: 40, width: 1600, height: 1000 }
    const left = clampPointToRect({ x: 0, y: 0 }, size, offset)
    expect(left).toEqual({ x: 100, y: 40 })
  })

  it('pins a window larger than the bounds to the origin', () => {
    const tiny = { x: 50, y: 50, width: 100, height: 100 }
    const result = clampPointToRect({ x: 80, y: 80 }, size, tiny)
    expect(result).toEqual({ x: 50, y: 50 })
  })
})

describe('parseStoredPosition', () => {
  it('parses valid x,y strings', () => {
    expect(parseStoredPosition('100,250')).toEqual({ x: 100, y: 250 })
    expect(parseStoredPosition('-12.5,0')).toEqual({ x: -12.5, y: 0 })
  })

  it('returns null for null or malformed values', () => {
    expect(parseStoredPosition(null)).toBeNull()
    expect(parseStoredPosition('')).toBeNull()
    expect(parseStoredPosition('100')).toBeNull()
    expect(parseStoredPosition('100,250,10')).toBeNull()
    expect(parseStoredPosition('abc,def')).toBeNull()
  })
})

describe('serializePosition', () => {
  it('rounds to integers and joins with a comma', () => {
    expect(serializePosition({ x: 100.4, y: 249.6 })).toBe('100,250')
  })

  it('round-trips through parseStoredPosition', () => {
    const point = { x: 1234, y: -567 }
    expect(parseStoredPosition(serializePosition(point))).toEqual(point)
  })
})
