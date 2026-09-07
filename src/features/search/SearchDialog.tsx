import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircleIcon, SearchIcon } from '../../components/icons'
import { formatFullDate } from '../../lib/date'
import { PRIORITY_DOT, PRIORITY_LABEL } from '../../lib/priority'
import { searchTasks } from '../../lib/search'
import { usePlanner } from '../planner/PlannerContext'
import type { Task } from '../../types/task'

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const planner = usePlanner()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(
    () => searchTasks(planner.allTasks, query),
    [planner.allTasks, query],
  )

  useEffect(() => inputRef.current?.focus(), [])

  const select = (task: Task) => {
    planner.revealTask(task)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh] animate-in fade-in duration-(--duration-fast)"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tasks"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-elevated animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-(--duration-base) ease-(--ease-out)"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((index) =>
              results.length === 0 ? 0 : (index + 1) % results.length,
            )
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) =>
              results.length === 0
                ? 0
                : (index - 1 + results.length) % results.length,
            )
          } else if (event.key === 'Enter' && results[activeIndex]) {
            event.preventDefault()
            select(results[activeIndex])
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            aria-label="Search all tasks"
            placeholder="Search all tasks"
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            className="min-w-0 flex-1 bg-transparent py-4 text-[0.9375rem] text-text outline-none placeholder:text-muted"
          />
        </div>

        <ul
          role="listbox"
          aria-label="Search results"
          className="max-h-[50vh] overflow-y-auto"
        >
          {results.map((task, index) => (
            <li key={task.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(task)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                  index === activeIndex ? 'bg-line' : ''
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
                  aria-hidden="true"
                />
                <span
                  className={`min-w-0 flex-1 truncate text-[0.9375rem] ${
                    task.completed ? 'text-done line-through' : 'text-text'
                  }`}
                >
                  {task.title}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {formatFullDate(task.date)}
                </span>
                <span className="sr-only">
                  {task.completed ? 'Completed' : 'Not completed'}. Priority{' '}
                  {PRIORITY_LABEL[task.priority]}
                </span>
                {task.completed && (
                  <CheckCircleIcon
                    className="h-4 w-4 shrink-0 text-done"
                    filled
                  />
                )}
              </button>
            </li>
          ))}

          {query.trim() !== '' && results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted">
              No tasks match “{query.trim()}”
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
