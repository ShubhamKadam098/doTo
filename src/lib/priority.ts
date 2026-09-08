import type { Priority } from '../types/task'

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/** Dot fill per level. `none` renders as an outline so state is never colour-only. */
export const PRIORITY_DOT: Record<Priority, string> = {
  none: 'border border-line-strong',
  low: 'bg-priority-low',
  medium: 'bg-priority-medium',
  high: 'bg-priority-high',
}

/** Pill fill per level, worn by the task title itself. */
const PRIORITY_FILL: Record<Exclude<Priority, 'none'>, string> = {
  low: 'bg-priority-low',
  medium: 'bg-priority-medium',
  high: 'bg-priority-high',
}

/** The same hue once the task is done, dulled against the black surface. */
const PRIORITY_FILL_DONE: Record<Exclude<Priority, 'none'>, string> = {
  low: 'bg-priority-low/20',
  medium: 'bg-priority-medium/20',
  high: 'bg-priority-high/20',
}

/**
 * Classes for the title of a task at `priority`. A level paints the title as a
 * filled pill; `none` leaves it as plain text. The pill bleeds past the text so
 * the fill has breathing room without indenting the title away from the
 * unprioritised rows above and below it.
 */
export function priorityPill(priority: Priority, completed: boolean): string {
  if (priority === 'none') {
    return completed ? 'text-done line-through' : 'text-text'
  }
  const shape = '-mx-2 rounded-full px-2 py-0.5'
  return completed
    ? `${shape} ${PRIORITY_FILL_DONE[priority]} text-done line-through`
    : `${shape} ${PRIORITY_FILL[priority]} text-surface`
}

/** Number keys 1-4 set priority on a focused row. */
export const PRIORITY_BY_KEY: Record<string, Priority> = {
  '1': 'none',
  '2': 'low',
  '3': 'medium',
  '4': 'high',
}
