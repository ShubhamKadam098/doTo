import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  formatDayNumber,
  formatWeekdayLong,
  formatWeekdayShort,
} from '../../lib/date'
import { TaskRow } from './TaskRow'
import type { DayModel } from './PlannerContext'

interface DayColumnProps {
  day: DayModel
  rowCount: number
}

export function DayColumn({ day, rowCount }: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${day.date}`,
    data: { date: day.date },
  })

  const slots = Array.from({ length: rowCount }, (_, index) => index)

  return (
    <section
      aria-label={`${formatWeekdayLong(day.date)} ${formatDayNumber(day.date)}`}
      className="flex min-w-0 flex-col"
    >
      <header
        className={`flex items-baseline justify-between gap-2 border-b pb-2 ${
          day.isToday ? 'border-accent' : 'border-line-strong'
        }`}
      >
        <h2
          className={`truncate text-[1.0625rem] font-bold tracking-tight ${
            day.isToday ? 'text-accent' : 'text-text'
          }`}
        >
          {formatDayNumber(day.date)}
          {day.isToday && <span className="sr-only"> (today)</span>}
        </h2>
        <span
          className={`shrink-0 text-[0.9375rem] ${
            day.isToday ? 'text-accent' : 'text-muted'
          }`}
        >
          {formatWeekdayShort(day.date)}
        </span>
      </header>

      <ul
        ref={setNodeRef}
        className={`min-w-0 transition-colors ${isOver ? 'bg-elevated/60' : ''}`}
      >
        <SortableContext
          items={day.tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {slots.map((index) => (
            <TaskRow
              key={day.tasks[index]?.id ?? `${day.date}:${index}`}
              date={day.date}
              row={index}
              task={day.tasks[index]}
              taskCount={day.tasks.length}
            />
          ))}
        </SortableContext>
      </ul>
    </section>
  )
}
