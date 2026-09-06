export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const

export type Priority = (typeof PRIORITIES)[number]

/** `date` is a local calendar day key: `yyyy-MM-dd`. Never a timestamp. */
export interface Task {
  id: string
  title: string
  date: string
  completed: boolean
  priority: Priority
  order: number
  createdAt: string
  updatedAt: string
}

export type Filter = 'all' | 'active' | 'completed'

export const FILTERS: readonly Filter[] = ['all', 'active', 'completed']
