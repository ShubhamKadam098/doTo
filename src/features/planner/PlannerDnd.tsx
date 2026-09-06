import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { tasksForDate } from '../../lib/tasks'
import { usePlanner } from './PlannerContext'
import type { Task } from '../../types/task'

const DAY_PREFIX = 'day:'

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

  const onDragStart = (event: DragStartEvent) => {
    setActive(
      planner.allTasks.find((task) => task.id === event.active.id) ?? null,
    )
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null)
    const { over } = event
    const dragged = planner.allTasks.find((task) => task.id === event.active.id)
    if (!over || !dragged) return

    const overId = String(over.id)

    if (overId.startsWith(DAY_PREFIX)) {
      const toDate = overId.slice(DAY_PREFIX.length)
      const destination = tasksForDate(planner.allTasks, toDate).filter(
        (task) => task.id !== dragged.id,
      )
      planner.relocateTask(dragged.id, toDate, destination.length)
      return
    }

    const target = planner.allTasks.find((task) => task.id === overId)
    if (!target || target.id === dragged.id) return

    if (target.date === dragged.date) {
      const list = tasksForDate(planner.allTasks, dragged.date)
      const toIndex = list.findIndex((task) => task.id === target.id)
      if (toIndex >= 0) planner.relocateTask(dragged.id, dragged.date, toIndex)
      return
    }

    const destination = tasksForDate(planner.allTasks, target.date).filter(
      (task) => task.id !== dragged.id,
    )
    const toIndex = destination.findIndex((task) => task.id === target.id)
    planner.relocateTask(dragged.id, target.date, Math.max(0, toIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="truncate rounded-md border border-line-strong bg-elevated px-2 py-1.5 text-[0.9375rem] text-text">
            {active.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
