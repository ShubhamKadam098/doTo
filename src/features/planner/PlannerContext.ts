import { createContext, useContext } from 'react'
import type { View } from '../../lib/viewPreference'
import type { Filter, Priority, Status, Task } from '../../types/task'

export interface FocusTarget {
  date: string
  row: number
}

export interface DayModel {
  date: string
  tasks: Task[]
  isToday: boolean
  /** Rows this day renders. Weekdays share one height; the weekend splits it. */
  rows: number
}

export interface PlannerValue {
  today: string
  weekStart: string
  days: DayModel[]
  filter: Filter
  view: View
  focus: FocusTarget | null
  /** Row that owns the tab stop before the user has focused anything. */
  defaultFocus: FocusTarget
  editing: boolean
  allTasks: Task[]
  canUndo: boolean
  canRedo: boolean

  setFilter: (filter: Filter) => void
  setView: (view: View) => void
  shiftWeek: (delta: number) => void
  goToToday: () => void
  revealTask: (task: Task) => void
  focusSlot: (target: FocusTarget | null, editing?: boolean) => void
  setEditing: (editing: boolean) => void
  moveFocus: (rowDelta: number, dayDelta: number) => void

  /**
   * Text typed into the open editor but not yet committed. Held outside the
   * row so an edit survives the row being torn down and rebuilt underneath it.
   */
  readDraft: () => string | null
  writeDraft: (value: string | null) => void

  createTask: (date: string, title: string, status?: Status) => void
  renameTask: (id: string, title: string) => void
  removeTask: (id: string) => void
  duplicateTask: (id: string) => void
  toggleTask: (id: string) => void
  setPriority: (id: string, priority: Priority) => void
  relocateTask: (id: string, toDate: string, toIndex: number) => void
  setStatus: (id: string, status: Status, toIndex?: number) => void
  reorderOnBoard: (id: string, toIndex: number) => void
  /** Hides a task without deleting it; Restore brings it back to Todo. */
  discardTask: (id: string) => void
  restoreTask: (id: string) => void
  undo: () => void
  redo: () => void
}

export const PlannerContext = createContext<PlannerValue | null>(null)

export function usePlanner(): PlannerValue {
  const value = useContext(PlannerContext)
  if (!value) {
    throw new Error('usePlanner must be used inside <PlannerProvider>')
  }
  return value
}

/** Row floor for a full-height weekday column. */
export const MIN_ROWS = 10

/** Row floor for Saturday, which shares its column with Sunday. */
export const WEEKEND_MIN_ROWS = 5
