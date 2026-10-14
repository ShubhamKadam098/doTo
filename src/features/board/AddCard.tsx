import { useState } from 'react'

/** "+ Add task" that opens into an input; Enter keeps it open for the next one. */
export function AddCard({
  label,
  onAdd,
}: {
  label: string
  onAdd: (title: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Add a task to ${label}`}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:text-text"
      >
        + Add task
      </button>
    )
  }

  const submit = () => {
    if (value.trim()) onAdd(value)
    setValue('')
  }

  return (
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
      className="w-full rounded-lg border border-accent/45 bg-elevated px-3 py-2 text-[0.9375rem] text-text outline-none placeholder:text-muted"
    />
  )
}
