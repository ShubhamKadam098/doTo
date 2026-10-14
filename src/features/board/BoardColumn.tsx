import { useDndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ReactNode } from 'react'
import { STATUS_LABEL, STATUS_RULE, STATUS_TEXT } from '../../lib/status'
import type { BoardStatus } from '../../types/task'
import { AddCard } from './AddCard'
import { COLUMN_PREFIX } from './boardModel'

/** One status as a column of ruled rows, headed like a day in the week. */
export function BoardColumn({
  status,
  count,
  ids,
  onAdd,
  children,
}: {
  status: BoardStatus
  count: number
  /** The column's card ids in order. */
  ids: string[]
  onAdd: (title: string) => void
  children: ReactNode
}) {
  const label = STATUS_LABEL[status]
  const id = `${COLUMN_PREFIX}${status}`
  const { setNodeRef } = useDroppable({ id })
  const { over } = useDndContext()
  // A card under the pointer is the drop target, not the column, so light
  // the column the card would land in either way.
  const isTarget =
    over !== null && (over.id === id || over.data.current?.status === status)

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      // Bleeds past the text so the drop wash never sits flush against it, and
      // stretches to the bottom of the window so the whole column lights up.
      className={`-mx-3 -mt-3 flex min-h-80 min-w-0 flex-1 flex-col rounded-xl px-3 pt-3 pb-3 transition-colors ${
        isTarget ? 'bg-elevated/60' : ''
      }`}
    >
      <header
        className={`flex items-baseline justify-between gap-2 border-b pb-2 ${STATUS_RULE[status]}`}
      >
        <h2
          className={`truncate text-[1.0625rem] font-bold tracking-tight ${STATUS_TEXT[status]}`}
        >
          {label}
        </h2>
        <span className="shrink-0 text-[0.9375rem] text-muted">{count}</span>
      </header>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="min-w-0">{children}</ul>
      </SortableContext>
      <AddCard label={label} onAdd={onAdd} />
    </section>
  )
}
