import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CheckCircleIcon } from '../../components/icons'
import { PriorityMenu } from '../../components/PriorityMenu'
import { formatWeekdayLong, formatDayNumber } from '../../lib/date'
import { PRIORITY_BY_KEY, PRIORITY_LABEL } from '../../lib/priority'
import { usePlanner } from './PlannerContext'
import type { Task } from '../../types/task'

export interface TaskRowProps {
  date: string
  row: number
  task?: Task
  /** Occupied rows in this day, used to place the caret after a creation. */
  taskCount: number
  variant?: 'desktop' | 'mobile'
  /** Mobile taps open the detail sheet instead of editing inline. */
  onOpenDetail?: (task: Task) => void
}

export function TaskRow({
  date,
  row,
  task,
  taskCount,
  variant = 'desktop',
  onOpenDetail,
}: TaskRowProps) {
  const planner = usePlanner()
  const { focus, editing } = planner
  const isFocused = focus?.date === date && focus.row === row
  const isTabbable = focus
    ? isFocused
    : planner.defaultFocus.date === date && planner.defaultFocus.row === row
  const isEditing = isFocused && editing
  const titleRef = useRef<HTMLButtonElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task?.id ?? `slot:${date}:${row}`,
    disabled: !task || isEditing,
    data: { date, taskId: task?.id },
  })

  useEffect(() => {
    if (isFocused && !isEditing) titleRef.current?.focus()
  }, [isFocused, isEditing])

  // A new task is always appended, so editing any blank row collapses onto the
  // first free one instead of leaving the caret stranded further down.
  const editRow = task ? row : taskCount
  const startEditing = () => planner.focusSlot({ date, row: editRow }, true)

  const commit = (value: string) => {
    if (task) planner.renameTask(task.id, value)
    else if (value.trim()) planner.createTask(date, value)
  }

  const finishEditing = (value: string, advance: boolean) => {
    const filled = value.trim().length > 0
    commit(value)

    if (!advance) {
      planner.focusSlot({ date, row })
      return
    }
    if (!task && !filled) {
      // Enter on an untouched blank row just leaves edit mode.
      planner.focusSlot({ date, row })
      return
    }
    // Clearing a title deletes the task, so the row below shifts up into `row`.
    const nextRow = task ? (filled ? row + 1 : row) : row + 1
    planner.focusSlot({ date, row: nextRow }, true)
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isEditing) return
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault()
        planner.moveFocus(event.key === 'ArrowUp' ? -1 : 1, 0)
        return
      case 'ArrowLeft':
      case 'ArrowRight':
        if (variant === 'mobile') return
        event.preventDefault()
        planner.moveFocus(0, event.key === 'ArrowLeft' ? -1 : 1)
        return
      case 'Enter':
        event.preventDefault()
        if (variant === 'mobile' && task && onOpenDetail) onOpenDetail(task)
        else startEditing()
        return
      case ' ':
        if (!task) return
        event.preventDefault()
        planner.toggleTask(task.id)
        return
      case 'Delete':
      case 'Backspace':
        if (!task) return
        event.preventDefault()
        planner.removeTask(task.id)
        return
      default:
        break
    }

    // Number keys set priority; every other letter is left to the global
    // shortcuts (T, N) so they keep working while a row has focus.
    if (task && PRIORITY_BY_KEY[event.key] && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      planner.setPriority(task.id, PRIORITY_BY_KEY[event.key])
    }
  }

  const isMobile = variant === 'mobile'
  const rowHeight = isMobile ? 'h-row-mobile' : 'h-row'
  const completed = task?.completed ?? false

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onKeyDown={onRowKeyDown}
      className={`group relative flex ${rowHeight} items-center gap-2 border-b border-line transition-colors ${
        isEditing
          ? 'bg-elevated ring-1 ring-accent/45 ring-inset'
          : isFocused
            ? 'bg-elevated'
            : 'hover:bg-elevated/50'
      } ${isDragging ? 'z-20 opacity-40' : ''}`}
    >
      {isEditing ? (
        <TitleInput
          initial={task?.title ?? ''}
          date={date}
          onCancel={() => planner.focusSlot({ date, row })}
          onCommit={finishEditing}
          onHistory={(direction) => {
            planner.focusSlot({ date, row })
            if (direction === 'undo') planner.undo()
            else planner.redo()
          }}
        />
      ) : (
        <button
          ref={titleRef}
          type="button"
          {...attributes}
          {...listeners}
          tabIndex={isTabbable ? 0 : -1}
          onFocus={() => {
            // Keeps keyboard navigation anchored to whatever the user focused.
            if (!isFocused) planner.focusSlot({ date, row })
          }}
          onClick={() => {
            if (isMobile && task && onOpenDetail) onOpenDetail(task)
            else startEditing()
          }}
          aria-label={
            task
              ? `${task.title}. ${formatWeekdayLong(date)} ${formatDayNumber(date)}. ${
                  completed ? 'Completed' : 'Not completed'
                }. Priority ${PRIORITY_LABEL[task.priority]}`
              : `Add a task on ${formatWeekdayLong(date)} ${formatDayNumber(date)}`
          }
          className={`min-w-0 flex-1 cursor-text truncate rounded-sm py-1 text-left text-[0.9375rem] focus-visible:outline-none ${
            task ? '' : 'text-transparent'
          } ${completed ? 'text-done line-through' : 'text-text'}`}
        >
          {task?.title ?? ' '}
        </button>
      )}

      {task && !isEditing && (
        <PriorityMenu
          value={task.priority}
          onChange={(priority) => planner.setPriority(task.id, priority)}
          tabIndex={-1}
          dim
        />
      )}

      {task && !isEditing && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => planner.toggleTask(task.id)}
          aria-label={`Mark "${task.title}" as ${
            completed ? 'not completed' : 'completed'
          }`}
          aria-pressed={completed}
          className={`shrink-0 rounded-full p-1 transition-opacity ${
            completed
              ? 'text-done opacity-100'
              : isMobile
                ? 'text-muted opacity-100'
                : 'text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
        >
          <CheckCircleIcon filled={completed} />
        </button>
      )}
    </li>
  )
}

interface TitleInputProps {
  initial: string
  date: string
  onCommit: (value: string, advance: boolean) => void
  onCancel: () => void
  /** Only fires from an empty editor, where the browser has nothing to undo. */
  onHistory: (direction: 'undo' | 'redo') => void
}

function TitleInput({
  initial,
  date,
  onCommit,
  onCancel,
  onHistory,
}: TitleInputProps) {
  const [value, setValue] = useState(initial)
  const cancelled = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [])

  return (
    <input
      ref={inputRef}
      value={value}
      aria-label={`Task title for ${formatWeekdayLong(date)} ${formatDayNumber(date)}`}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (cancelled.current) return
        onCommit(value, false)
      }}
      onKeyDown={(event) => {
        const modifier = event.metaKey || event.ctrlKey
        if (event.key === 'Enter') {
          event.preventDefault()
          cancelled.current = true
          onCommit(value, true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          cancelled.current = true
          onCancel()
        } else if (modifier && event.key.toLowerCase() === 'z' && value === '') {
          // Enter always leaves the caret in the next editor, so an empty one
          // must not swallow undo. A typed-in editor keeps native text undo.
          event.preventDefault()
          cancelled.current = true
          onHistory(event.shiftKey ? 'redo' : 'undo')
        }
        // Every other key, spaces included, edits the text normally.
        event.stopPropagation()
      }}
      className="min-w-0 flex-1 bg-transparent py-1 text-[0.9375rem] text-text outline-none placeholder:text-muted"
      placeholder="Task"
    />
  )
}
