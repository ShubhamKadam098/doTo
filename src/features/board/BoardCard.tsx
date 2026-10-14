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
import { formatDayNumber, formatWeekdayLong } from '../../lib/date'
import { PRIORITY_LABEL, priorityPill } from '../../lib/priority'
import { usePlanner } from '../planner/PlannerContext'
import type { Task } from '../../types/task'

export interface BoardCardProps {
  task: Task
  isFocused: boolean
  /** One card owns the tab stop, as one row does in the week. */
  isTabbable: boolean
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
  /** Called before a menu action removes the card from the board. */
  onLeave: () => void
  /** Touch has no hover, so mobile drops the priority dot and the menu. */
  variant?: 'desktop' | 'mobile'
}

export function BoardCard({
  task,
  isFocused,
  isTabbable,
  onFocus,
  onKeyDown,
  onOpen,
  onLeave,
  variant = 'desktop',
}: BoardCardProps) {
  const planner = usePlanner()
  const ref = useRef<HTMLButtonElement>(null)
  const done = task.status === 'done'
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
    // Ruled like a week row, so the two views read as one planner.
    className: `group relative isolate flex ${
      isMobile ? 'h-row-mobile' : 'h-row'
    } items-center gap-2 border-b border-line ${isDragging ? 'z-20 opacity-40' : ''}`,
  }

  const content = (
    <>
      {/* Bleeds past the text, as on week rows, so the highlight has room. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 -inset-x-3 -z-10 rounded-lg transition-colors ${
          isFocused ? 'bg-elevated' : ''
        }`}
      />
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
        className="flex min-w-0 flex-1 items-center py-1 text-left text-[0.9375rem] focus-visible:outline-none"
      >
        <span className={`min-w-0 truncate transition-colors ${priorityPill(task.priority, done)}`}>
          {task.title}
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
          onDiscard={() => {
            onLeave()
            planner.discardTask(task.id)
          }}
          onRestore={() => planner.restoreTask(task.id)}
        />
        <ContextMenuItem onClick={() => planner.duplicateTask(task.id)}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={() => {
            onLeave()
            planner.removeTask(task.id)
          }}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
