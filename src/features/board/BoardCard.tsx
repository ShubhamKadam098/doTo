import { useEffect, useRef, type KeyboardEvent } from 'react'
import { formatDayNumber, formatWeekdayLong, formatWeekdayShort } from '../../lib/date'
import { PRIORITY_LABEL, priorityPill } from '../../lib/priority'
import type { Task } from '../../types/task'

export interface BoardCardProps {
  task: Task
  today: string
  isFocused: boolean
  /** One card owns the tab stop, as one row does in the week. */
  isTabbable: boolean
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
}

export function BoardCard({
  task,
  today,
  isFocused,
  isTabbable,
  onFocus,
  onKeyDown,
  onOpen,
}: BoardCardProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const done = task.status === 'done'
  const isToday = task.date === today

  // Follows the card across columns: a move remounts it in its new column.
  useEffect(() => {
    if (isFocused) ref.current?.focus()
  }, [isFocused])

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={isTabbable ? 0 : -1}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={onOpen}
      aria-label={`${task.title}. ${formatWeekdayLong(task.date)} ${formatDayNumber(
        task.date,
      )}. Priority ${PRIORITY_LABEL[task.priority]}`}
      className={`flex w-full flex-col items-start gap-1.5 rounded-lg border bg-elevated px-3 py-2.5 text-left transition-colors focus-visible:outline-none ${
        isFocused ? 'border-accent/60' : 'border-line hover:border-line-strong'
      }`}
    >
      <span className={`max-w-full truncate text-[0.9375rem] ${priorityPill(task.priority, done)}`}>
        {task.title}
      </span>
      <span className={`text-xs ${isToday ? 'text-accent' : 'text-muted'}`}>
        {formatWeekdayShort(task.date)} {formatDayNumber(task.date)}
      </span>
    </button>
  )
}
