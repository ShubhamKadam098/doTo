import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { PriorityMenu } from '../../components/PriorityMenu'
import { StatusMenuItems } from '../../components/StatusMenuItems'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../components/ui/context-menu'
import { formatDayNumber, formatWeekdayLong, formatWeekdayShort } from '../../lib/date'
import { PRIORITY_LABEL, priorityPill } from '../../lib/priority'
import { usePlanner } from '../planner/PlannerContext'
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
  /** Touch has no hover, so mobile drops the priority dot and the menu. */
  variant?: 'desktop' | 'mobile'
}

export function BoardCard({
  task,
  today,
  isFocused,
  isTabbable,
  onFocus,
  onKeyDown,
  onOpen,
  variant = 'desktop',
}: BoardCardProps) {
  const planner = usePlanner()
  const ref = useRef<HTMLButtonElement>(null)
  const done = task.status === 'done'
  const isToday = task.date === today
  const isMobile = variant === 'mobile'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { status: task.status } })

  // Follows the card across columns: a move remounts it in its new column.
  useEffect(() => {
    if (isFocused) ref.current?.focus()
  }, [isFocused])

  const itemProps = {
    ref: setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition },
    ...listeners,
    className: `group relative flex items-start gap-2 rounded-lg border bg-elevated px-3 py-2.5 transition-colors ${
      isFocused ? 'border-accent/60' : 'border-line hover:border-line-strong'
    } ${isDragging ? 'z-20 opacity-40' : ''}`,
  }

  const content = (
    <>
      <button
        ref={ref}
        type="button"
        {...attributes}
        tabIndex={isTabbable ? 0 : -1}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onClick={onOpen}
        aria-label={`${task.title}. ${formatWeekdayLong(task.date)} ${formatDayNumber(
          task.date,
        )}. Priority ${PRIORITY_LABEL[task.priority]}`}
        className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left focus-visible:outline-none"
      >
        <span className={`max-w-full truncate text-[0.9375rem] ${priorityPill(task.priority, done)}`}>
          {task.title}
        </span>
        <span className={`text-xs ${isToday ? 'text-accent' : 'text-muted'}`}>
          {formatWeekdayShort(task.date)} {formatDayNumber(task.date)}
        </span>
      </button>
      {!isMobile && (
        <PriorityMenu
          value={task.priority}
          onChange={(priority) => planner.setPriority(task.id, priority)}
          tabIndex={-1}
          dim
        />
      )}
    </>
  )

  if (isMobile) return <li {...itemProps}>{content}</li>

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<li {...itemProps} />}>{content}</ContextMenuTrigger>
      <ContextMenuContent>
        <StatusMenuItems
          task={task}
          onMove={(status) => planner.setStatus(task.id, status)}
          onDiscard={() => planner.discardTask(task.id)}
          onRestore={() => planner.restoreTask(task.id)}
        />
        <ContextMenuItem onClick={() => planner.duplicateTask(task.id)}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={() => planner.removeTask(task.id)}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
