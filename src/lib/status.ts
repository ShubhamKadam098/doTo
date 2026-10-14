import type { BoardStatus, Status } from '../types/task'

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
export function showsStatusPill(
  status: Status,
): status is 'in_progress' | 'waiting' {
  return status === 'in_progress' || status === 'waiting'
}

/* Written out in full so Tailwind can find every class in the source. */

/** Each column's hue on its header text and tab. */
export const STATUS_TEXT: Record<BoardStatus, string> = {
  todo: 'text-status-todo',
  in_progress: 'text-status-progress',
  waiting: 'text-status-waiting',
  done: 'text-status-done',
}

/** The rule under each column header, in the column's hue. */
export const STATUS_RULE: Record<BoardStatus, string> = {
  todo: 'border-status-todo/60',
  in_progress: 'border-status-progress/60',
  waiting: 'border-status-waiting/60',
  done: 'border-status-done/60',
}

/**
 * The week's status pill: an outline and text in the status hue, never a fill,
 * so it stays quieter than the priority pill beside it.
 */
export const STATUS_PILL: Record<'in_progress' | 'waiting', string> = {
  in_progress: 'border-status-progress/50 text-status-progress',
  waiting: 'border-status-waiting/50 text-status-waiting',
}
