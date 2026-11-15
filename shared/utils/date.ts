/**
 * Local-calendar date helpers shared by the main process, renderer, and tests.
 *
 * All persistent date keys in soloLeving use the `YYYY-MM-DD` local format.
 * Never use `toISOString()` for day keys: it converts to UTC and can shift
 * logs into the wrong calendar day.
 */

/** Returns the local calendar day key `YYYY-MM-DD` for a given Date. */
export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Validates a `YYYY-MM-DD` local date key. */
export function isLocalDateKey(key: string): boolean {
  if (!DATE_KEY_PATTERN.test(key)) return false
  const [, year, month, day] = DATE_KEY_PATTERN.exec(key) ?? []
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  )
}

/** Parses a `YYYY-MM-DD` key back into a local Date at midnight. */
export function fromLocalDateKey(key: string): Date {
  if (!isLocalDateKey(key)) {
    throw new Error(`Invalid local date key: ${key}`)
  }
  const [, year, month, day] = DATE_KEY_PATTERN.exec(key) ?? []
  return new Date(Number(year), Number(month) - 1, Number(day))
}

/**
 * Inclusive date-key comparison helpers. Lexicographic comparison is safe for
 * the zero-padded YYYY-MM-DD format.
 */
export function isDateKeyBefore(a: string, b: string): boolean {
  return a < b
}

export function isDateKeyOnOrBefore(a: string, b: string): boolean {
  return a <= b
}

/** Formats minutes as a compact human string, e.g. "1h 45m" or "30m". */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

/** Adds a number of days (negative to go back) to a local date key. */
export function addDaysToKey(key: string, days: number): string {
  const date = fromLocalDateKey(key)
  date.setDate(date.getDate() + days)
  return toLocalDateKey(date)
}

/** Returns the previous local day key. */
export function previousDateKey(key: string): string {
  return addDaysToKey(key, -1)
}
