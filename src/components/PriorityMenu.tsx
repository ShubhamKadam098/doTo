import { useState } from 'react'
import { PRIORITY_DOT, PRIORITY_LABEL } from '../lib/priority'
import { PRIORITIES, type Priority } from '../types/task'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface PriorityMenuProps {
  value: Priority
  onChange: (priority: Priority) => void
  /** Hides the `none` dot until the row is hovered or focused. */
  dim?: boolean
  /** Rows pass -1 so the dot does not add a tab stop per task. */
  tabIndex?: number
}

export function PriorityMenu({
  value,
  onChange,
  dim,
  tabIndex,
}: PriorityMenuProps) {
  const [open, setOpen] = useState(false)
  const hidden = dim && value === 'none' && !open

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Priority: ${PRIORITY_LABEL[value]}. Change priority`}
            title={`Priority: ${PRIORITY_LABEL[value]}`}
            tabIndex={tabIndex}
            className={`flex h-5 w-5 items-center justify-center rounded-full transition-opacity ${
              hidden
                ? 'opacity-0 group-hover:opacity-60 group-focus-within:opacity-60'
                : 'opacity-100'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${PRIORITY_DOT[value]}`}
              aria-hidden="true"
            />
          </button>
        }
      />

      {/* Base UI names the menu after its trigger, so it needs no label. */}
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as Priority)}
        >
          {PRIORITIES.map((priority) => (
            <DropdownMenuRadioItem
              key={priority}
              value={priority}
              // Picking a level is the whole interaction; radio items keep the
              // menu open by default, which leaves it hanging over the row.
              closeOnClick
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priority]}`}
                aria-hidden="true"
              />
              {PRIORITY_LABEL[priority]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
