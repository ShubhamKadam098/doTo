import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/IconButton'
import { CheckCircleIcon, CloseIcon, TrashIcon } from '../../components/icons'
import { formatFullDate } from '../../lib/date'
import { PRIORITY_DOT, PRIORITY_LABEL } from '../../lib/priority'
import { usePlanner } from './PlannerContext'
import { PRIORITIES, type Task } from '../../types/task'

/** Focused mobile editor: rename, complete, prioritise or delete one task. */
export function TaskDetailSheet({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const planner = usePlanner()
  const [title, setTitle] = useState(task.title)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const commitTitle = () => {
    if (title.trim() !== task.title) planner.renameTask(task.id, title)
  }

  const close = () => {
    commitTitle()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/70 p-3"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Task: ${task.title}`}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
        className="w-full rounded-2xl border border-line bg-elevated p-5 pb-7"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{formatFullDate(task.date)}</p>
          <div className="flex items-center gap-1">
            <IconButton
              label="Delete task"
              onClick={() => {
                planner.removeTask(task.id)
                onClose()
              }}
            >
              <TrashIcon className="h-[1.125rem] w-[1.125rem]" />
            </IconButton>
            <IconButton label="Close" onClick={close}>
              <CloseIcon className="h-[1.125rem] w-[1.125rem]" />
            </IconButton>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 border-b border-line pb-3">
          <input
            value={title}
            aria-label="Task title"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTitle()
                onClose()
              }
            }}
            className={`min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none ${
              task.completed ? 'text-done line-through' : 'text-text'
            }`}
          />
          <button
            type="button"
            onClick={() => planner.toggleTask(task.id)}
            aria-label={`Mark as ${task.completed ? 'not completed' : 'completed'}`}
            aria-pressed={task.completed}
            className={`shrink-0 rounded-full p-1 ${
              task.completed ? 'text-done' : 'text-muted'
            }`}
          >
            <CheckCircleIcon className="h-6 w-6" filled={task.completed} />
          </button>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm text-muted">Priority</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                aria-pressed={task.priority === priority}
                onClick={() => planner.setPriority(task.id, priority)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  task.priority === priority
                    ? 'border-line-strong text-text'
                    : 'border-line text-muted'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`}
                  aria-hidden="true"
                />
                {PRIORITY_LABEL[priority]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
