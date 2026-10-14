export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const

export type Priority = (typeof PRIORITIES)[number]

export const STATUSES = [
  'todo',
  'in_progress',
  'waiting',
  'done',
  'discarded',
] as const

export type Status = (typeof STATUSES)[number]

/** Board columns, left to right. Discarded is an action, not a column. */
export const BOARD_STATUSES = [
  'todo',
  'in_progress',
  'waiting',
  'done',
] as const satisfies readonly Status[]

export type BoardStatus = (typeof BOARD_STATUSES)[number]

/** Still to be done: these roll over and count as active. */
export const OPEN_STATUSES: readonly Status[] = ['todo', 'in_progress', 'waiting']

export function isBoardStatus(status: Status): status is BoardStatus {
  return (BOARD_STATUSES as readonly Status[]).includes(status)
}

/** `date` is a local calendar day key: `yyyy-MM-dd`. Never a timestamp. */
export interface Task {
  id: string
  title: string
  date: string
  status: Status
  priority: Priority
  /** Position within its day. */
  order: number
  /** Position within its status column on the board. */
  boardOrder: number
  createdAt: string
  updatedAt: string
}

export type Filter = 'all' | 'active' | 'completed'

export const FILTERS: readonly Filter[] = ['all', 'active', 'completed']
