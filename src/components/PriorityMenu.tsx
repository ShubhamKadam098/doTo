import { useEffect, useRef, useState } from 'react'
import { PRIORITY_DOT, PRIORITY_LABEL } from '../lib/priority'
import { PRIORITIES, type Priority } from '../types/task'

interface PriorityMenuProps {
  value: Priority
  onChange: (priority: Priority) => void
  /** Hides the `none` dot until the row is hovered or focused. */
  dim?: boolean
}

export function PriorityMenu({ value, onChange, dim }: PriorityMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const hidden = dim && value === 'none' && !open

  return (
    <div
      ref={containerRef}
      className="relative flex items-center"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        aria-label={`Priority: ${PRIORITY_LABEL[value]}. Change priority`}
        title={`Priority: ${PRIORITY_LABEL[value]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-5 w-5 items-center justify-center rounded-full transition-opacity ${
          hidden ? 'opacity-0 group-hover:opacity-60 group-focus-within:opacity-60' : 'opacity-100'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${PRIORITY_DOT[value]}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Priority"
          className="absolute top-6 right-0 z-30 w-32 rounded-lg border border-line bg-elevated py-1"
        >
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              role="menuitemradio"
              aria-checked={priority === value}
              onClick={() => {
                onChange(priority)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-line ${
                priority === value ? 'text-text' : 'text-muted'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priority]}`}
                aria-hidden="true"
              />
              {PRIORITY_LABEL[priority]}
              {priority === value && <span aria-hidden="true" className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
