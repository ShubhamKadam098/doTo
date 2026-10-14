import type { ReactNode } from 'react'
import { STATUS_LABEL } from '../../lib/status'
import type { BoardStatus } from '../../types/task'
import { AddCard } from './AddCard'

export function BoardColumn({
  status,
  count,
  onAdd,
  children,
}: {
  status: BoardStatus
  count: number
  onAdd: (title: string) => void
  children: ReactNode
}) {
  const label = STATUS_LABEL[status]
  return (
    <section aria-label={label} className="flex min-w-0 flex-col">
      <header className="flex items-baseline justify-between border-b border-line-strong pb-2">
        <h2 className="text-[1.0625rem] font-bold tracking-tight">{label}</h2>
        <span className="text-sm text-muted">{count}</span>
      </header>
      <ul className="flex flex-col gap-2 pt-3">
        {children}
        {count === 0 && (
          <li className="px-3 py-2 text-sm text-muted">Nothing here</li>
        )}
      </ul>
      <div className="pt-2">
        <AddCard label={label} onAdd={onAdd} />
      </div>
    </section>
  )
}
