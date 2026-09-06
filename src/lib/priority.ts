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

/** Number keys 1-4 set priority on a focused row. */
export const PRIORITY_BY_KEY: Record<string, Priority> = {
  '1': 'none',
  '2': 'low',
  '3': 'medium',
  '4': 'high',
}
