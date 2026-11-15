/**
 * Widget window geometry helpers. Pure functions so they are unit-testable
 * without Electron's screen module (tests pass plain rects).
 */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Clamps a point so the window (at `windowSize`) stays fully inside `bounds`.
 * A window bigger than the bounds is pinned to the bounds' origin.
 */
export function clampPointToRect(
  point: Point,
  windowSize: { width: number; height: number },
  bounds: Rect
): Point {
  const maxX = Math.max(bounds.x, bounds.x + bounds.width - windowSize.width)
  const maxY = Math.max(bounds.y, bounds.y + bounds.height - windowSize.height)
  return {
    x: Math.min(Math.max(point.x, bounds.x), maxX),
    y: Math.min(Math.max(point.y, bounds.y), maxY)
  }
}

/**
 * Parses a stored position string ("x,y" with finite numbers). Returns null for
 * malformed/legacy values so callers can fall back to the default placement.
 */
export function parseStoredPosition(raw: string | null): Point | null {
  if (raw === null) return null
  const parts = raw.split(',')
  if (parts.length !== 2) return null
  const x = Number(parts[0])
  const y = Number(parts[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

export function serializePosition(point: Point): string {
  return `${Math.round(point.x)},${Math.round(point.y)}`
}
