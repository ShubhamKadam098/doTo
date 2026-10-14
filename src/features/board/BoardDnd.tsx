import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type Active,
  type DragEndEvent,
  type DragOverEvent,
  type Over,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useState, type ReactNode } from 'react'
import { usePlanner } from '../planner/PlannerContext'
import {
  COLUMN_PREFIX,
  TAB_PREFIX,
  columnIndexFor,
  resolveBoardDrop,
  type BoardPreview,
} from './boardModel'
import type { BoardStatus, Task } from '../../types/task'

const isCardId = (id: string | number) =>
  !String(id).startsWith(COLUMN_PREFIX) && !String(id).startsWith(TAB_PREFIX)

/*
 * Same reasoning as the week: ask what the pointer is inside before comparing
 * centres, so a tall neighbouring column never wins over the one under it.
 * A column hit on its header or empty space would otherwise mean "append",
 * which made the top of a column unreachable; its nearest card stands in, so
 * a drop above the first card lands first and one below the last lands last.
 */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  const cards = underPointer.filter((hit) => isCardId(hit.id))
  if (cards.length > 0) return cards

  const column = underPointer.find((hit) =>
    String(hit.id).startsWith(COLUMN_PREFIX),
  )
  if (column) {
    const status = String(column.id).slice(COLUMN_PREFIX.length)
    const inColumn = args.droppableContainers.filter(
      (container) =>
        isCardId(container.id) && container.data.current?.status === status,
    )
    return inColumn.length > 0
      ? closestCenter({ ...args, droppableContainers: inColumn })
      : [column]
  }

  if (underPointer.length > 0) return underPointer
  const intersecting = rectIntersection(args)
  return intersecting.length > 0 ? intersecting : closestCenter(args)
}

/** The dragged card's middle sits below the middle of what it is over. */
function isBelow(active: Active, over: Over): boolean {
  const dragged = active.rect.current.translated
  return (
    dragged !== null &&
    dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2
  )
}

interface Column {
  status: BoardStatus
  tasks: Task[]
}

export function BoardDnd({
  dates,
  columns,
  onPreview,
  children,
}: {
  dates: ReadonlySet<string>
  /** The columns as shown, including any mid-drag preview. */
  columns: Column[]
  onPreview: (preview: BoardPreview | null) => void
  children: ReactNode
}) {
  const planner = usePlanner()
  const [active, setActive] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  useEffect(() => {
    if (!active) return
    document.body.dataset.dragging = 'true'
    return () => {
      delete document.body.dataset.dragging
    }
  }, [active])

  const onDragStart = (event: DragStartEvent) => {
    setActive(planner.allTasks.find((task) => task.id === event.active.id) ?? null)
  }

  const shownStatusOf = (id: string) =>
    columns.find((column) => column.tasks.some((task) => task.id === id))
      ?.status

  /*
   * Entering another column moves the card into it as a preview, so that
   * column's cards part around it; within one column dnd-kit's own sorting
   * does the parting. Only the drop writes anything.
   */
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    if (overId.startsWith(TAB_PREFIX)) return

    const from = shownStatusOf(id)
    const to = overId.startsWith(COLUMN_PREFIX)
      ? (overId.slice(COLUMN_PREFIX.length) as BoardStatus)
      : shownStatusOf(overId)
    if (!from || !to || from === to) return

    // Back in its own column: drop the preview and let sorting take over.
    if (planner.allTasks.find((task) => task.id === id)?.status === to) {
      onPreview(null)
      return
    }
    const target = columns.find((column) => column.status === to)?.tasks ?? []
    const overIndex = target.findIndex((task) => task.id === overId)
    onPreview({
      id,
      status: to,
      index:
        overIndex < 0
          ? target.length
          : overIndex + (isBelow(active, over) ? 1 : 0),
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null)
    onPreview(null)
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)

    // Mobile tabs name a column that is not on screen: append to it.
    if (overId.startsWith(TAB_PREFIX)) {
      const drop = resolveBoardDrop(planner.allTasks, dates, id, overId)
      if (drop) planner.setStatus(id, drop.status, drop.toIndex)
      return
    }

    const status = shownStatusOf(id)
    if (!status) return
    const shown = columns.find((column) => column.status === status)!.tasks
    // The card already sits in its landing column (moved there by the
    // preview), so landing works like a reorder: it takes the place of what
    // it is over, or stays where the preview put it.
    const overIndex =
      shownStatusOf(overId) === status
        ? shown.findIndex((task) => task.id === overId)
        : -1
    const landing =
      overIndex >= 0 ? overIndex : shown.findIndex((task) => task.id === id)
    // setStatus is a no-op for a card dropped back where it started.
    planner.setStatus(
      id,
      status,
      columnIndexFor(planner.allTasks, status, dates, id, landing),
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null)
        onPreview(null)
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="cursor-grabbing truncate rounded-md border border-line-strong bg-elevated px-2 py-1.5 text-[0.9375rem] text-text">
            {active.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
