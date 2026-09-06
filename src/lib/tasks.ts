import { createId } from './id'
import type { Filter, Priority, Task } from '../types/task'

export function nowIso(): string {
  return new Date().toISOString()
}

export function byOrder(a: Task, b: Task): number {
  if (a.order !== b.order) return a.order - b.order
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
}

/** Tasks for one day, in display order. */
export function tasksForDate(tasks: Task[], date: string): Task[] {
  return tasks.filter((task) => task.date === date).sort(byOrder)
}

export function applyFilter(tasks: Task[], filter: Filter): Task[] {
  if (filter === 'active') return tasks.filter((task) => !task.completed)
  if (filter === 'completed') return tasks.filter((task) => task.completed)
  return tasks
}

/** Rewrites `order` to dense 0..n-1 within each affected day. */
export function normalizeOrders(tasks: Task[], dates?: string[]): Task[] {
  const targets = dates ? new Set(dates) : null
  const nextOrder = new Map<string, number>()
  const grouped = new Map<string, Task[]>()

  for (const task of tasks) {
    if (targets && !targets.has(task.date)) continue
    const list = grouped.get(task.date)
    if (list) list.push(task)
    else grouped.set(task.date, [task])
  }

  const resolved = new Map<string, number>()
  for (const [date, list] of grouped) {
    list.sort(byOrder)
    list.forEach((task, index) => resolved.set(task.id, index))
    nextOrder.set(date, list.length)
  }

  return tasks.map((task) => {
    const order = resolved.get(task.id)
    return order === undefined || order === task.order
      ? task
      : { ...task, order }
  })
}

export function createTask(input: {
  title: string
  date: string
  priority?: Priority
  order: number
}): Task {
  const timestamp = nowIso()
  return {
    id: createId(),
    title: input.title,
    date: input.date,
    completed: false,
    priority: input.priority ?? 'none',
    order: input.order,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Appends a new task to the end of `date`. Empty titles are rejected. */
export function addTask(
  tasks: Task[],
  input: { title: string; date: string; priority?: Priority },
): { tasks: Task[]; task: Task } | null {
  const title = input.title.trim()
  if (title.length === 0) return null
  const order = tasksForDate(tasks, input.date).length
  const task = createTask({ ...input, title, order })
  return { tasks: [...tasks, task], task }
}

export function updateTask(
  tasks: Task[],
  id: string,
  patch: Partial<Pick<Task, 'title' | 'completed' | 'priority'>>,
): Task[] {
  return tasks.map((task) =>
    task.id === id ? { ...task, ...patch, updatedAt: nowIso() } : task,
  )
}

export function deleteTask(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks
  return normalizeOrders(
    tasks.filter((task) => task.id !== id),
    [target.date],
  )
}

export function toggleCompleted(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks
  return updateTask(tasks, id, { completed: !target.completed })
}

/**
 * Moves a task to `toDate` at `toIndex`, covering both reordering within a day
 * and moving between days. Task identity and every other field are preserved.
 */
export function moveTask(
  tasks: Task[],
  id: string,
  toDate: string,
  toIndex: number,
): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks

  const fromDate = target.date
  const destination = tasksForDate(tasks, toDate).filter(
    (task) => task.id !== id,
  )
  const index = Math.max(0, Math.min(toIndex, destination.length))
  destination.splice(index, 0, { ...target, date: toDate })

  const orderById = new Map<string, number>()
  destination.forEach((task, position) => orderById.set(task.id, position))

  const moved = tasks.map((task) => {
    if (task.id === id) {
      return {
        ...task,
        date: toDate,
        order: orderById.get(id) ?? index,
        updatedAt: nowIso(),
      }
    }
    const order = orderById.get(task.id)
    return order === undefined || order === task.order
      ? task
      : { ...task, order }
  })

  return fromDate === toDate ? moved : normalizeOrders(moved, [fromDate])
}
