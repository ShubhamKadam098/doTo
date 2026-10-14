import { useMemo, useState } from 'react'
import { weekDayKeys } from '../../lib/date'
import { BOARD_STATUSES } from '../../types/task'
import { usePlanner } from '../planner/PlannerContext'
import { BoardCard } from './BoardCard'
import { BoardColumn } from './BoardColumn'
import { boardColumn } from './boardModel'

/** The visible week's tasks as four status columns. */
export function Board({ isDesktop }: { isDesktop: boolean }) {
  const planner = usePlanner()
  const [focusId, setFocusId] = useState<string | null>(null)

  const dates = useMemo(
    () => new Set(weekDayKeys(planner.weekStart)),
    [planner.weekStart],
  )
  const columns = useMemo(
    () =>
      BOARD_STATUSES.map((status) => ({
        status,
        tasks: boardColumn(planner.allTasks, status, dates),
      })),
    [planner.allTasks, dates],
  )

  // New cards land on today when it is in view, else on the week's Monday.
  const addDate = dates.has(planner.today) ? planner.today : planner.weekStart
  const firstId = columns.find((column) => column.tasks.length > 0)?.tasks[0].id

  return (
    <div
      className={
        isDesktop
          ? 'grid grid-cols-4 gap-6 px-10 pb-24'
          : 'flex flex-col gap-8 px-4 pb-24'
      }
    >
      {columns.map(({ status, tasks }) => (
        <BoardColumn
          key={status}
          status={status}
          count={tasks.length}
          onAdd={(title) => planner.createTask(addDate, title, status)}
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <BoardCard
                task={task}
                today={planner.today}
                isFocused={focusId === task.id}
                isTabbable={(focusId ?? firstId) === task.id}
                onFocus={() => setFocusId(task.id)}
                onKeyDown={() => {}}
                onOpen={() => {}}
              />
            </li>
          ))}
        </BoardColumn>
      ))}
    </div>
  )
}
