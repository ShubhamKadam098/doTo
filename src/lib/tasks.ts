import { createId } from './id'
import { OPEN_STATUSES, type Filter, type Priority, type Status, type Task } from '../types/task'

export function nowIso(): string {
  return new Date().toISOString()
}

export function byOrder(a: Task, b: Task): number {
  if (a.order !== b.order) return a.order - b.order
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
}

export function isOpen(task: Task): boolean {
  return OPEN_STATUSES.includes(task.status)
}

/** Board position, falling back to the week's own order so ties read naturally. */
export function byBoardOrder(a: Task, b: Task): number {
  if (a.boardOrder !== b.boardOrder) return a.boardOrder - b.boardOrder
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return byOrder(a, b)
}

/** Tasks for one day, in display order. */
export function tasksForDate(tasks: Task[], date: string): Task[] {
  return tasks.filter((task) => task.date === date).sort(byOrder)
}

export function applyFilter(tasks: Task[], filter: Filter): Task[] {
  if (filter === 'active') return tasks.filter(isOpen)
  if (filter === 'completed') {
    return tasks.filter((task) => task.status === 'done')
  }
  if (filter === 'discarded') {
    return tasks.filter((task) => task.status === 'discarded')
  }
  return tasks.filter((task) => task.status !== 'discarded')
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

/** Rewrites `boardOrder` to dense 0..n-1 within each affected status column. */
export function normalizeBoardOrders(
  tasks: Task[],
  statuses?: Status[],
): Task[] {
  const targets = statuses ? new Set(statuses) : null
  const grouped = new Map<Status, Task[]>()

  for (const task of tasks) {
    if (targets && !targets.has(task.status)) continue
    const list = grouped.get(task.status)
    if (list) list.push(task)
    else grouped.set(task.status, [task])
  }

  const resolved = new Map<string, number>()
  for (const list of grouped.values()) {
    list.sort(byBoardOrder)
    list.forEach((task, index) => resolved.set(task.id, index))
  }

  return tasks.map((task) => {
    const boardOrder = resolved.get(task.id)
    return boardOrder === undefined || boardOrder === task.boardOrder
      ? task
      : { ...task, boardOrder }
  })
}

export function createTask(input: {
  title: string
  date: string
  priority?: Priority
  status?: Status
  order: number
  boardOrder: number
}): Task {
  const timestamp = nowIso()
  return {
    id: createId(),
    title: input.title,
    date: input.date,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'none',
    order: input.order,
    boardOrder: input.boardOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Appends a new task to the end of its day and its column. Empty titles are rejected. */
export function addTask(
  tasks: Task[],
  input: { title: string; date: string; priority?: Priority; status?: Status },
): { tasks: Task[]; task: Task } | null {
  const title = input.title.trim()
  if (title.length === 0) return null
  const status = input.status ?? 'todo'
  const task = createTask({
    ...input,
    title,
    status,
    order: tasksForDate(tasks, input.date).length,
    boardOrder: tasks.filter((task) => task.status === status).length,
  })
  return { tasks: [...tasks, task], task }
}

export function updateTask(
  tasks: Task[],
  id: string,
  patch: Partial<Pick<Task, 'title' | 'priority'>>,
): Task[] {
  return tasks.map((task) =>
    task.id === id ? { ...task, ...patch, updatedAt: nowIso() } : task,
  )
}

export function deleteTask(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks
  return normalizeBoardOrders(
    normalizeOrders(
      tasks.filter((task) => task.id !== id),
      [target.date],
    ),
    [target.status],
  )
}

/**
 * Moves a task into `status` at `toIndex` within that column (the bottom when
 * omitted), closing the gap it leaves. Covers reordering within a column too.
 * Never changes the task's day or its place in that day.
 */
export function setStatus(
  tasks: Task[],
  id: string,
  status: Status,
  toIndex?: number,
): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks
  if (target.status === status && toIndex === undefined) return tasks

  const column = tasks
    .filter((task) => task.status === status && task.id !== id)
    .sort(byBoardOrder)
  const index = Math.max(0, Math.min(toIndex ?? column.length, column.length))

  if (target.status === status) {
    const current = tasks
      .filter((task) => task.status === status)
      .sort(byBoardOrder)
      .findIndex((task) => task.id === id)
    if (current === index) return tasks
  }

  column.splice(index, 0, target)
  const orderById = new Map<string, number>()
  column.forEach((task, position) => orderById.set(task.id, position))

  const timestamp = nowIso()
  const moved = tasks.map((task) => {
    const boardOrder = orderById.get(task.id)
    if (task.id === id) {
      return { ...task, status, boardOrder: boardOrder ?? index, updatedAt: timestamp }
    }
    return boardOrder === undefined || boardOrder === task.boardOrder
      ? task
      : { ...task, boardOrder }
  })

  return target.status === status
    ? moved
    : normalizeBoardOrders(moved, [target.status])
}

/** Moves a task within its own column. */
export function reorderOnBoard(
  tasks: Task[],
  id: string,
  toIndex: number,
): Task[] {
  const target = tasks.find((task) => task.id === id)
  return target ? setStatus(tasks, id, target.status, toIndex) : tasks
}

/** The week's checkbox: Done reopens to Todo, anything open becomes Done. */
export function toggleCompleted(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target || target.status === 'discarded') return tasks
  return setStatus(tasks, id, target.status === 'done' ? 'todo' : 'done')
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

/**
 * Copies a task in beneath the original. An open task's copy keeps its status
 * and sits under it on the board; a done or discarded one starts over in Todo.
 */
export function duplicateTask(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks

  const status = isOpen(target) ? target.status : 'todo'
  const sameColumn = status === target.status

  const copy = createTask({
    title: target.title,
    date: target.date,
    priority: target.priority,
    status,
    order: target.order + 1,
    boardOrder: sameColumn
      ? target.boardOrder + 1
      : tasks.filter((task) => task.status === status).length,
  })

  const shifted = tasks.map((task) => {
    let next = task
    if (task.date === target.date && task.order > target.order) {
      next = { ...next, order: next.order + 1 }
    }
    if (
      sameColumn &&
      task.status === status &&
      task.boardOrder > target.boardOrder
    ) {
      next = { ...next, boardOrder: next.boardOrder + 1 }
    }
    return next
  })

  return normalizeBoardOrders(
    normalizeOrders(shifted.concat(copy), [target.date]),
    [status],
  )
}
