import { useMemo, useState, type KeyboardEvent } from 'react'
import { weekDayKeys } from '../../lib/date'
import { PRIORITY_BY_KEY } from '../../lib/priority'
import { BOARD_STATUSES, type Task } from '../../types/task'
import { usePlanner } from '../planner/PlannerContext'
import { TaskDetailSheet } from '../planner/TaskDetailSheet'
import { BoardCard } from './BoardCard'
import { BoardColumn } from './BoardColumn'
import { BoardDnd } from './BoardDnd'
import { boardColumn, columnIndexFor } from './boardModel'

/** The visible week's tasks as four status columns. */
export function Board({ isDesktop }: { isDesktop: boolean }) {
  const planner = usePlanner()
  const [focusId, setFocusId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = planner.allTasks.find((task) => task.id === detailId) ?? null

  const dates = useMemo(
    () => new Set(weekDayKeys(planner.weekStart)),
    [planner.weekStart],
  )
  const columns = useMemo(
    () =>
      BOARD_STATUSES.map((status) => ({
        status,
        tasks: boardColumn(planner.allTasks, status, dates),
      })),
    [planner.allTasks, dates],
  )

  // New cards land on today when it is in view, else on the week's Monday.
  const addDate = dates.has(planner.today) ? planner.today : planner.weekStart
  const firstId = columns.find((column) => column.tasks.length > 0)?.tasks[0].id
  // A week change, discard or delete can drop the focused card; the tab stop must survive.
  const visibleIds = new Set(columns.flatMap((column) => column.tasks.map((task) => task.id)))
  const tabId = focusId && visibleIds.has(focusId) ? focusId : firstId

  const locate = (id: string) => {
    for (let c = 0; c < columns.length; c++) {
      const r = columns[c].tasks.findIndex((task) => task.id === id)
      if (r >= 0) return { c, r }
    }
    return null
  }

  const moveFocus = (id: string, dc: number, dr: number) => {
    const at = locate(id)
    if (!at) return
    if (dc === 0) {
      const list = columns[at.c].tasks
      setFocusId(list[Math.max(0, Math.min(list.length - 1, at.r + dr))].id)
      return
    }
    // Skip empty columns so focus never lands on nothing.
    let c = at.c + dc
    while (c >= 0 && c < columns.length && columns[c].tasks.length === 0) c += dc
    if (c < 0 || c >= columns.length) return
    const list = columns[c].tasks
    setFocusId(list[Math.min(at.r, list.length - 1)].id)
  }

  const moveCard = (task: Task, dc: number, dr: number) => {
    const at = locate(task.id)
    if (!at) return
    if (dc !== 0) {
      const next = BOARD_STATUSES[at.c + dc]
      if (!next) return
      planner.setStatus(
        task.id,
        next,
        columnIndexFor(planner.allTasks, next, dates, task.id, Number.POSITIVE_INFINITY),
      )
      return
    }
    const to = at.r + dr
    if (to < 0 || to >= columns[at.c].tasks.length) return
    planner.reorderOnBoard(
      task.id,
      columnIndexFor(planner.allTasks, task.status, dates, task.id, to),
    )
  }

  const onCardKeyDown = (task: Task) => (event: KeyboardEvent<HTMLElement>) => {
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }
    const arrow = arrows[event.key]
    if (arrow) {
      event.preventDefault()
      if (event.altKey) moveCard(task, ...arrow)
      else moveFocus(task.id, ...arrow)
      return
    }
    if (event.altKey || event.metaKey || event.ctrlKey) return

    if (event.key === 'Enter') {
      event.preventDefault()
      setDetailId(task.id)
    } else if (event.key === ' ') {
      event.preventDefault()
      planner.toggleTask(task.id)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      moveFocus(task.id, 0, 1)
      planner.removeTask(task.id)
    } else if (PRIORITY_BY_KEY[event.key]) {
      event.preventDefault()
      planner.setPriority(task.id, PRIORITY_BY_KEY[event.key])
    }
  }

  return (
    <BoardDnd dates={dates}>
      <div
        className={
          isDesktop
            ? 'grid grid-cols-4 gap-6 px-10 pb-24'
            : 'flex flex-col gap-8 px-4 pb-24'
        }
      >
        {columns.map(({ status, tasks }) => (
          <BoardColumn
            key={status}
            status={status}
            count={tasks.length}
            ids={tasks.map((task) => task.id)}
            onAdd={(title) => planner.createTask(addDate, title, status)}
          >
            {tasks.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                today={planner.today}
                isFocused={focusId === task.id}
                isTabbable={tabId === task.id}
                onFocus={() => setFocusId(task.id)}
                onKeyDown={onCardKeyDown(task)}
                onOpen={() => setDetailId(task.id)}
                variant={isDesktop ? 'desktop' : 'mobile'}
              />
            ))}
          </BoardColumn>
        ))}
      </div>

      {detail && (
        <TaskDetailSheet task={detail} onClose={() => setDetailId(null)} />
      )}
    </BoardDnd>
  )
}
