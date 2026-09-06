import {
  addDays,
  addWeeks,
  format,
  isValid,
  parse,
  startOfWeek,
} from 'date-fns'

/** Weeks run Monday -> Sunday, matching the planner layout. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const

export const DATE_KEY_FORMAT = 'yyyy-MM-dd'

/** Formats a Date as a local-timezone calendar day key. */
export function toDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT)
}

/** Parses a `yyyy-MM-dd` key into a local-midnight Date. */
export function fromDateKey(key: string): Date {
  return parse(key, DATE_KEY_FORMAT, new Date())
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const parsed = fromDateKey(value)
  return isValid(parsed) && toDateKey(parsed) === value
}

/** Today in the browser's local timezone. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

export function startOfWeekKey(dateOrKey: Date | string): string {
  const date =
    typeof dateOrKey === 'string' ? fromDateKey(dateOrKey) : dateOrKey
  return toDateKey(startOfWeek(date, WEEK_OPTIONS))
}

export function addWeeksToKey(key: string, amount: number): string {
  return toDateKey(addWeeks(fromDateKey(key), amount))
}

export function addDaysToKey(key: string, amount: number): string {
  return toDateKey(addDays(fromDateKey(key), amount))
}

/** The seven day keys of the week containing `weekStart`. */
export function weekDayKeys(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    addDaysToKey(weekStart, index),
  )
}

export function formatDayNumber(key: string): string {
  return format(fromDateKey(key), 'd MMM')
}

export function formatWeekdayShort(key: string): string {
  return format(fromDateKey(key), 'EEE')
}

export function formatWeekdayLong(key: string): string {
  return format(fromDateKey(key), 'EEEE')
}

export function formatFullDate(key: string): string {
  return format(fromDateKey(key), 'EEE, d MMM yyyy')
}

/** Header title for a week, e.g. "August 2026" or "Aug - Sep 2026". */
export function formatWeekTitle(weekStart: string): string {
  const start = fromDateKey(weekStart)
  const end = fromDateKey(addDaysToKey(weekStart, 6))
  if (start.getMonth() === end.getMonth()) {
    return format(start, 'MMMM yyyy')
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM')} – ${format(end, 'MMM yyyy')}`
  }
  return `${format(start, 'MMM yyyy')} – ${format(end, 'MMM yyyy')}`
}

export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
