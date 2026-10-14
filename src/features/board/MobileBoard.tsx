import { useDroppable } from '@dnd-kit/core'
import { useRef, useState, type ReactNode } from 'react'
import { STATUS_LABEL } from '../../lib/status'
import type { BoardStatus, Task } from '../../types/task'
import { BoardColumn } from './BoardColumn'
import { TAB_PREFIX } from './boardModel'

interface Column {
  status: BoardStatus
  tasks: Task[]
}

/** Four columns do not fit a phone: one at a time, switched by tab or swipe. */
export function MobileBoard({
  columns,
  renderCard,
  onAdd,
}: {
  columns: Column[]
  renderCard: (task: Task) => ReactNode
  onAdd: (status: BoardStatus, title: string) => void
}) {
  const [index, setIndex] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const current = columns[index]

  return (
    <div className="px-4 pb-24">
      <div
        role="tablist"
        aria-label="Board columns"
        className="flex gap-1 overflow-x-auto pb-4"
      >
        {columns.map((column, i) => (
          <ColumnTab
            key={column.status}
            status={column.status}
            count={column.tasks.length}
            selected={i === index}
            onSelect={() => setIndex(i)}
          />
        ))}
      </div>

      <div
        role="tabpanel"
        aria-label={STATUS_LABEL[current.status]}
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          touchStart.current = null
          if (!start) return
          const touch = event.changedTouches[0]
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          // A clear horizontal flick; vertical scrolling and long-press drags pass.
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
          setIndex((i) => Math.max(0, Math.min(columns.length - 1, i + (dx < 0 ? 1 : -1))))
        }}
      >
        <BoardColumn
          status={current.status}
          count={current.tasks.length}
          ids={current.tasks.map((task) => task.id)}
          onAdd={(title) => onAdd(current.status, title)}
        >
          {current.tasks.map(renderCard)}
        </BoardColumn>
      </div>
    </div>
  )
}

/** A tab is also a drop target: dropping a card on it moves it to that column. */
function ColumnTab({
  status,
  count,
  selected,
  onSelect,
}: {
  status: BoardStatus
  count: number
  selected: boolean
  onSelect: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${TAB_PREFIX}${status}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] transition-colors ${
        selected || isOver ? 'bg-elevated text-text' : 'text-muted'
      }`}
    >
      {STATUS_LABEL[status]} <span className="text-muted">{count}</span>
    </button>
  )
}
