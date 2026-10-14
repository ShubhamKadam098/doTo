import { isDateKey } from './date'
import { normalizeBoardOrders } from './tasks'
import {
  PRIORITIES,
  STATUSES,
  type Priority,
  type Status,
  type Task,
} from '../types/task'

export const STORAGE_KEY = 'doto.state'
export const STORAGE_VERSION = 2

export interface PersistedState {
  version: number
  tasks: Task[]
  lastRolloverDate: string | null
}

export interface LoadResult {
  state: PersistedState
  /** True when stored data existed but part of it could not be read. */
  recovered: boolean
}

export const EMPTY_STATE: PersistedState = {
  version: STORAGE_VERSION,
  tasks: [],
  lastRolloverDate: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : 'none'
}

/** Version 1 stored a `completed` flag; it maps onto done or todo. */
function asStatus(value: unknown, legacyCompleted: unknown): Status {
  if (STATUSES.includes(value as Status)) return value as Status
  return legacyCompleted === true ? 'done' : 'todo'
}

function asTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value
    : fallback
}

/**
 * Validates a single stored record. Returns null for anything unusable so a
 * malformed entry costs the user one task rather than the whole planner.
 */
export function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) return null
  const { id, title, date } = value
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof title !== 'string') return null
  if (!isDateKey(date)) return null

  const createdAt = asTimestamp(value.createdAt, new Date(0).toISOString())
  return {
    id,
    title,
    date,
    status: asStatus(value.status, value.completed),
    priority: asPriority(value.priority),
    order: typeof value.order === 'number' && Number.isFinite(value.order)
      ? value.order
      : 0,
    // Unknown positions sort last; `load` ranks each column as a whole.
    boardOrder:
      typeof value.boardOrder === 'number' && Number.isFinite(value.boardOrder)
        ? value.boardOrder
        : Number.POSITIVE_INFINITY,
    createdAt,
    updatedAt: asTimestamp(value.updatedAt, createdAt),
  }
}

/** Applies forward migrations. Unknown/older shapes fall back to defaults. */
function migrate(raw: Record<string, unknown>): {
  tasks: unknown[]
  lastRolloverDate: string | null
} {
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : []
  const last = raw.lastRolloverDate
  return {
    tasks,
    lastRolloverDate: isDateKey(last) ? last : null,
  }
}

export function load(storage: Storage | undefined = safeStorage()): LoadResult {
  if (!storage) return { state: { ...EMPTY_STATE }, recovered: false }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { state: { ...EMPTY_STATE }, recovered: false }
  }
  if (raw === null) return { state: { ...EMPTY_STATE }, recovered: false }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { state: { ...EMPTY_STATE }, recovered: true }
  }
  if (!isRecord(parsed)) {
    return { state: { ...EMPTY_STATE }, recovered: true }
  }

  const { tasks: rawTasks, lastRolloverDate } = migrate(parsed)
  const tasks: Task[] = []
  const seen = new Set<string>()
  let recovered = typeof parsed.version !== 'number'

  for (const entry of rawTasks) {
    const task = parseTask(entry)
    if (!task || seen.has(task.id)) {
      recovered = true
      continue
    }
    seen.add(task.id)
    tasks.push(task)
  }

  return {
    state: {
      version: STORAGE_VERSION,
      tasks: normalizeBoardOrders(tasks),
      lastRolloverDate,
    },
    recovered,
  }
}

export function save(
  state: PersistedState,
  storage: Storage | undefined = safeStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, version: STORAGE_VERSION }),
    )
  } catch {
    // Quota or private-mode failures must not break the app.
  }
}

/** localStorage is absent in SSR/tests and can throw in locked-down browsers. */
export function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}
