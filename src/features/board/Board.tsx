import { useMemo, useState, type KeyboardEvent } from 'react'
import { weekDayKeys } from '../../lib/date'
import { PRIORITY_BY_KEY } from '../../lib/priority'
import { BOARD_STATUSES, type Task } from '../../types/task'
import { usePlanner } from '../planner/PlannerContext'
import { TaskDetailSheet } from '../planner/TaskDetailSheet'
import { BoardCard } from './BoardCard'
import { BoardColumn } from './BoardColumn'
import { BoardDnd } from './BoardDnd'
import { MobileBoard } from './MobileBoard'
import {
  boardColumn,
  columnIndexFor,
  previewColumns,
  type BoardPreview,
} from './boardModel'

/** The visible week's tasks as four status columns. */
export function Board({ isDesktop }: { isDesktop: boolean }) {
  const planner = usePlanner()
  const [focusId, setFocusId] = useState<string | null>(null)
  const [mobileIndex, setMobileIndex] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [preview, setPreview] = useState<BoardPreview | null>(null)
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
  // What is drawn: the stored columns, plus a card mid-drag into another one.
  const shown = useMemo(() => previewColumns(columns, preview), [columns, preview])

  // New cards land on today when it is in view, else on the week's Monday.
  const addDate = dates.has(planner.today) ? planner.today : planner.weekStart
  // A week change, discard or delete can drop the focused card; the tab stop must survive.
  // On mobile only the current column is mounted, so the tab stop must live in it.
  const stopScope = isDesktop ? columns.flatMap((column) => column.tasks) : columns[mobileIndex].tasks
  const tabId = stopScope.some((task) => task.id === focusId) ? focusId : stopScope[0]?.id

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
    if (!isDesktop) setMobileIndex(c)
    setFocusId(list[Math.min(at.r, list.length - 1)].id)
  }

  // A removed card takes the DOM focus with it, so hand it to a neighbour first.
  const focusNeighbourOf = (id: string) => {
    const at = locate(id)
    if (!at) return
    const own = columns[at.c].tasks
    if (own.length > 1) {
      setFocusId(own[at.r > 0 ? at.r - 1 : 1].id)
      return
    }
    const others = [
      ...columns.slice(at.c + 1),
      ...columns.slice(0, at.c).reverse(),
    ].filter((column) => column.tasks.length > 0)
    const next = others[0]
    if (!next) {
      setFocusId(null)
      return
    }
    if (!isDesktop) setMobileIndex(columns.indexOf(next))
    setFocusId(next.tasks[Math.min(at.r, next.tasks.length - 1)].id)
  }

  const leaveColumn = (id: string) => {
    if (focusId === id) focusNeighbourOf(id)
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
      if (!isDesktop) setMobileIndex(at.c + dc)
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
      focusNeighbourOf(task.id)
      planner.removeTask(task.id)
    } else if (PRIORITY_BY_KEY[event.key]) {
      event.preventDefault()
      planner.setPriority(task.id, PRIORITY_BY_KEY[event.key])
    }
  }

  const renderCard = (task: Task) => (
    <BoardCard
      key={task.id}
      task={task}
      isFocused={focusId === task.id && detailId === null}
      isTabbable={tabId === task.id}
      onFocus={() => setFocusId(task.id)}
      onKeyDown={onCardKeyDown(task)}
      onOpen={() => setDetailId(task.id)}
      onLeave={() => leaveColumn(task.id)}
      variant={isDesktop ? 'desktop' : 'mobile'}
    />
  )

  return (
    <BoardDnd dates={dates} columns={shown} onPreview={setPreview}>
      {isDesktop ? (
        <div className="grid flex-1 grid-cols-4 gap-x-6 px-6 pb-10 sm:px-10 lg:gap-x-8">
          {shown.map(({ status, tasks }) => (
            <BoardColumn
              key={status}
              status={status}
              count={tasks.length}
              ids={tasks.map((task) => task.id)}
              onAdd={(title) => planner.createTask(addDate, title, status)}
            >
              {tasks.map(renderCard)}
            </BoardColumn>
          ))}
        </div>
      ) : (
        <MobileBoard
          columns={shown}
          index={mobileIndex}
          onIndexChange={setMobileIndex}
          renderCard={renderCard}
          onAdd={(status, title) => planner.createTask(addDate, title, status)}
        />
      )}

      {detail && (
        <TaskDetailSheet task={detail} onClose={() => setDetailId(null)} />
      )}
    </BoardDnd>
  )
}
