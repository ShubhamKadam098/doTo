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
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useState, type ReactNode } from 'react'
import { usePlanner } from './PlannerContext'
import { resolveDrop } from './resolveDrop'
import type { Task } from '../../types/task'

/*
 * Day columns are droppables that span their whole column, so comparing rect
 * centres (`closestCenter`) lets a far-away column win over the one actually
 * under the cursor, which made dragging between days unreliable. Ask what the
 * pointer is inside first; rows sort ahead of the column that contains them.
 */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  if (underPointer.length > 0) return underPointer

  const intersecting = rectIntersection(args)
  return intersecting.length > 0 ? intersecting : closestCenter(args)
}

export function PlannerDnd({ children }: { children: ReactNode }) {
  const planner = usePlanner()
  const [active, setActive] = useState<Task | null>(null)

  const sensors = useSensors(
    // A short distance/delay keeps click-to-edit and page scrolling intact.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  )

  // The pointer roams far from the dragged row, so the held cursor has to be
  // set on the page rather than on the row itself.
  useEffect(() => {
    if (!active) return
    document.body.dataset.dragging = 'true'
    return () => {
      delete document.body.dataset.dragging
    }
  }, [active])

  const onDragStart = (event: DragStartEvent) => {
    setActive(
      planner.allTasks.find((task) => task.id === event.active.id) ?? null,
    )
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null)
    const { over } = event
    if (!over) return

    const draggedId = String(event.active.id)
    const drop = resolveDrop(planner.allTasks, draggedId, {
      id: String(over.id),
      date: over.data.current?.date as string | undefined,
    })
    if (!drop) return

    planner.relocateTask(draggedId, drop.toDate, drop.toIndex)
    // Selection is positional, so without this it stays on the row the task
    // left rather than following it.
    planner.focusSlot({ date: drop.toDate, row: drop.toIndex })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
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
