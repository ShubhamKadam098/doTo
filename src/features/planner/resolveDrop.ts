import { tasksForDate } from '../../lib/tasks'
import type { Task } from '../../types/task'

export const DAY_PREFIX = 'day:'

/** What the pointer was released over, flattened out of the dnd-kit event. */
export interface DropOver {
  id: string
  /** Every row droppable carries its day, blank slots included. */
  date?: string
}

export interface Drop {
  toDate: string
  toIndex: number
}

/**
 * Works out where a dragged task should land.
 *
 * A drop resolves against one of three targets: another task, a day column, or
 * one of the blank slots padding a column out to a uniform height. Slots are
 * the common case, since they cover most of a column, and they name a day
 * without naming a task — so they mean "append to this day".
 *
 * Returns null when the drop is a no-op.
 */
export function resolveDrop(
  tasks: Task[],
  activeId: string,
  over: DropOver,
): Drop | null {
  const dragged = tasks.find((task) => task.id === activeId)
  if (!dragged) return null

  const target = tasks.find((task) => task.id === over.id)

  if (!target) {
    const toDate = over.id.startsWith(DAY_PREFIX)
      ? over.id.slice(DAY_PREFIX.length)
      : over.date
    if (!toDate) return null

    const destination = tasksForDate(tasks, toDate).filter(
      (task) => task.id !== dragged.id,
    )
    return { toDate, toIndex: destination.length }
  }

  if (target.id === dragged.id) return null

  if (target.date === dragged.date) {
    // Indexed against the day as it stands so that dragging a task downwards
    // past another lands after it rather than one short.
    const toIndex = tasksForDate(tasks, dragged.date).findIndex(
      (task) => task.id === target.id,
    )
    return toIndex < 0 ? null : { toDate: dragged.date, toIndex }
  }

  const destination = tasksForDate(tasks, target.date).filter(
    (task) => task.id !== dragged.id,
  )
  const toIndex = destination.findIndex((task) => task.id === target.id)
  return { toDate: target.date, toIndex: Math.max(0, toIndex) }
}
