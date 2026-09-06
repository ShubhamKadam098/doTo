import { byOrder, nowIso } from './tasks'
import type { Task } from '../types/task'

export interface RolloverResult {
  tasks: Task[]
  /** Ids that were moved. Empty when nothing was due. */
  movedIds: string[]
}

/**
 * Moves every incomplete task dated before `today` onto `today`, appended after
 * the tasks already there and keeping their relative order. Completed tasks and
 * future tasks are never touched, and no task is ever duplicated: ids, titles,
 * completion state and priority are all preserved.
 */
export function rollover(tasks: Task[], today: string): RolloverResult {
  const due = tasks
    .filter((task) => !task.completed && task.date < today)
    .sort((a, b) =>
      a.date === b.date ? byOrder(a, b) : a.date < b.date ? -1 : 1,
    )

  if (due.length === 0) return { tasks, movedIds: [] }

  const dueIds = new Set(due.map((task) => task.id))
  const touchedDates = new Set(due.map((task) => task.date))
  let nextOrder = tasks.filter((task) => task.date === today).length

  const orderById = new Map<string, number>()
  for (const task of due) orderById.set(task.id, nextOrder++)

  const timestamp = nowIso()
  const rolled = tasks.map((task) =>
    dueIds.has(task.id)
      ? {
          ...task,
          date: today,
          order: orderById.get(task.id) ?? task.order,
          updatedAt: timestamp,
        }
      : task,
  )

  return {
    tasks: compactDates(rolled, touchedDates),
    movedIds: due.map((task) => task.id),
  }
}

/** Closes the gaps left in the days a rollover emptied out. */
function compactDates(tasks: Task[], dates: Set<string>): Task[] {
  const orderById = new Map<string, number>()
  for (const date of dates) {
    tasks
      .filter((task) => task.date === date)
      .sort(byOrder)
      .forEach((task, index) => orderById.set(task.id, index))
  }
  return tasks.map((task) => {
    const order = orderById.get(task.id)
    return order === undefined || order === task.order
      ? task
      : { ...task, order }
  })
}
