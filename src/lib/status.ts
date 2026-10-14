import type { Status } from '../types/task'

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
  discarded: 'Discarded',
}

/**
 * Week rows only call out the in-between states: Todo is the default and Done
 * already has its strikethrough.
 */
export function showsStatusPill(status: Status): boolean {
  return status === 'in_progress' || status === 'waiting'
}
