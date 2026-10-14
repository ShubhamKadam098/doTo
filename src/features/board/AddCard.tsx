import { useState } from 'react'

/**
 * "+ Add task" as a ruled row like the week's blank ones; it opens into an
 * input in place, and Enter keeps it open for the next task.
 */
export function AddCard({
  label,
  onAdd,
}: {
  label: string
  onAdd: (title: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const submit = () => {
    if (value.trim()) onAdd(value)
    setValue('')
  }

  return (
    <div className="relative isolate flex h-row items-center border-b border-line">
      {open && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -inset-x-3 -z-10 rounded-lg bg-elevated ring-1 ring-accent/45 ring-inset"
        />
      )}
      {open ? (
        <input
          autoFocus
          value={value}
          aria-label={`New ${label} task`}
          placeholder="Task"
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            submit()
            setOpen(false)
          }}
          onKeyDown={(event) => {
            // Typing must never reach the board's or the page's shortcuts.
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setValue('')
              setOpen(false)
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-1 text-[0.9375rem] text-text outline-none placeholder:text-muted"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Add a task to ${label}`}
          className="flex-1 py-1 text-left text-[0.9375rem] text-muted transition-colors hover:text-text"
        >
          + Add task
        </button>
      )}
    </div>
  )
}
