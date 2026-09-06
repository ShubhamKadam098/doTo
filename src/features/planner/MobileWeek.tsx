import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import {
  formatDayNumber,
  formatWeekdayLong,
  formatWeekdayShort,
} from '../../lib/date'
import { TaskDetailSheet } from './TaskDetailSheet'
import { TaskRow } from './TaskRow'
import { usePlanner, type DayModel } from './PlannerContext'
import type { Task } from '../../types/task'

/** Mobile planner: the week as a vertical day-by-day timeline. */
export function MobileWeek() {
  const planner = usePlanner()
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = planner.allTasks.find((task) => task.id === detailId) ?? null

  return (
    <div className="px-4 pb-24">
      {planner.days.map((day) => (
        <MobileDaySection
          key={day.date}
          day={day}
          onOpenDetail={(task) => setDetailId(task.id)}
        />
      ))}

      {detail && (
        <TaskDetailSheet task={detail} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

interface MobileDaySectionProps {
  day: DayModel
  onOpenDetail: (task: Task) => void
}

function MobileDaySection({ day, onOpenDetail }: MobileDaySectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${day.date}`,
    data: { date: day.date },
  })

  return (
    <section
      aria-label={`${formatWeekdayLong(day.date)} ${formatDayNumber(day.date)}`}
      className="pt-8 first:pt-2"
    >
      <header
        className={`flex items-baseline justify-between gap-2 border-b pb-2 ${
          day.isToday ? 'border-accent' : 'border-line-strong'
        }`}
      >
        <h2
          className={`text-[1.0625rem] font-bold tracking-tight ${
            day.isToday ? 'text-accent' : 'text-text'
          }`}
        >
          {formatDayNumber(day.date)}
          {day.isToday && <span className="sr-only"> (today)</span>}
        </h2>
        <span
          className={`text-[0.9375rem] ${day.isToday ? 'text-accent' : 'text-muted'}`}
        >
          {formatWeekdayShort(day.date)}
        </span>
      </header>

      <ul
        ref={setNodeRef}
        className={`transition-colors ${isOver ? 'bg-elevated/60' : ''}`}
      >
        <SortableContext
          items={day.tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {day.tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              date={day.date}
              row={index}
              task={task}
              taskCount={day.tasks.length}
              variant="mobile"
              onOpenDetail={onOpenDetail}
            />
          ))}
        </SortableContext>
        <TaskRow
          date={day.date}
          row={day.tasks.length}
          taskCount={day.tasks.length}
          variant="mobile"
        />
      </ul>
    </section>
  )
}
