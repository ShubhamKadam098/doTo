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
import { usePlanner } from '../planner/PlannerContext'
import { resolveBoardDrop } from './boardModel'
import type { Task } from '../../types/task'

// Same reasoning as the week: ask what the pointer is inside before comparing
// centres, so a tall neighbouring column never wins over the one under it.
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  if (underPointer.length > 0) return underPointer
  const intersecting = rectIntersection(args)
  return intersecting.length > 0 ? intersecting : closestCenter(args)
}

export function BoardDnd({
  dates,
  children,
}: {
  dates: ReadonlySet<string>
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

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null)
    if (!event.over) return
    const id = String(event.active.id)
    const drop = resolveBoardDrop(planner.allTasks, dates, id, String(event.over.id))
    // setStatus covers reordering within a column and is a no-op in place.
    if (drop) planner.setStatus(id, drop.status, drop.toIndex)
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
          <div className="cursor-grabbing truncate rounded-lg border border-line-strong bg-elevated px-3 py-2.5 text-[0.9375rem] text-text">
            {active.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
