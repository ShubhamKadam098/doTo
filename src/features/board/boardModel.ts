import { byBoardOrder } from '../../lib/tasks'
import {
  BOARD_STATUSES,
  isBoardStatus,
  type BoardStatus,
  type Status,
  type Task,
} from '../../types/task'

export const COLUMN_PREFIX = 'column:'
export const TAB_PREFIX = 'tab:'

/** The visible week's tasks in one status, in board order. */
export function boardColumn(
  tasks: Task[],
  status: Status,
  dates: ReadonlySet<string>,
): Task[] {
  return tasks
    .filter((task) => task.status === status && dates.has(task.date))
    .sort(byBoardOrder)
}

/**
 * Translates a position among the cards the board shows into a position in the
 * whole column, which also holds other weeks' tasks. `visibleIndex` follows
 * array-move semantics against the visible column as it stands (including `id`
 * when it is already there), so dragging down past a card lands after it. Past
 * the end means "after the last visible card".
 */
export function columnIndexFor(
  tasks: Task[],
  status: Status,
  dates: ReadonlySet<string>,
  id: string,
  visibleIndex: number,
): number {
  const full = tasks
    .filter((task) => task.status === status && task.id !== id)
    .sort(byBoardOrder)
  const visible = full.filter((task) => dates.has(task.date))

  if (visibleIndex >= visible.length) {
    const last = visible.at(-1)
    return last ? full.indexOf(last) + 1 : full.length
  }
  return full.indexOf(visible[Math.max(0, visibleIndex)])
}

function statusFromDropId(overId: string): BoardStatus | null {
  const prefix = [COLUMN_PREFIX, TAB_PREFIX].find((p) => overId.startsWith(p))
  if (!prefix) return null
  const name = overId.slice(prefix.length)
  return (BOARD_STATUSES as readonly string[]).includes(name)
    ? (name as BoardStatus)
    : null
}

/**
 * Works out where a dragged card lands: on another card (its column, at its
 * place), or on a column or mobile tab (the bottom of that column). Returns
 * null when the drop names nothing usable.
 */
export function resolveBoardDrop(
  tasks: Task[],
  dates: ReadonlySet<string>,
  activeId: string,
  overId: string,
): { status: BoardStatus; toIndex: number } | null {
  if (!tasks.some((task) => task.id === activeId)) return null

  const named = statusFromDropId(overId)
  if (named) {
    return {
      status: named,
      toIndex: columnIndexFor(tasks, named, dates, activeId, Number.POSITIVE_INFINITY),
    }
  }

  const target = tasks.find((task) => task.id === overId)
  if (!target || target.id === activeId || !isBoardStatus(target.status)) {
    return null
  }
  const visibleIndex = boardColumn(tasks, target.status, dates).findIndex(
    (task) => task.id === target.id,
  )
  return {
    status: target.status,
    toIndex: columnIndexFor(tasks, target.status, dates, activeId, visibleIndex),
  }
}

/** Where a card being dragged into another column would land, mid-drag. */
export interface BoardPreview {
  id: string
  status: BoardStatus
  /** Position among that column's visible cards. */
  index: number
}

/**
 * The columns as they look mid-drag: the dragged card lifted out of its own
 * column and shown at its landing place in another, so the cards there part
 * around it. Nothing is stored until the drop.
 */
export function previewColumns<C extends { status: BoardStatus; tasks: Task[] }>(
  columns: C[],
  preview: BoardPreview | null,
): C[] {
  if (!preview) return columns
  const moving = columns
    .flatMap((column) => column.tasks)
    .find((task) => task.id === preview.id)
  if (!moving) return columns

  return columns.map((column) => {
    const tasks = column.tasks.filter((task) => task.id !== preview.id)
    if (column.status === preview.status) {
      const index = Math.max(0, Math.min(preview.index, tasks.length))
      // Wears the column it is shown in, so drop targeting and its look agree.
      tasks.splice(index, 0, { ...moving, status: preview.status })
    }
    return { ...column, tasks }
  })
}
