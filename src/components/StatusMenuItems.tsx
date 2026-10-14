import { STATUS_LABEL } from '../lib/status'
import { BOARD_STATUSES, type BoardStatus, type Task } from '../types/task'
import { ContextMenuItem } from './ui/context-menu'

interface StatusMenuItemsProps {
  task: Task
  onMove: (status: BoardStatus) => void
  onDiscard: () => void
  onRestore: () => void
}

/** "Move to …" for every other column, then Discard (or Restore). Shared by week rows and board cards. */
export function StatusMenuItems({
  task,
  onMove,
  onDiscard,
  onRestore,
}: StatusMenuItemsProps) {
  if (task.status === 'discarded') {
    return <ContextMenuItem onClick={onRestore}>Restore</ContextMenuItem>
  }
  return (
    <>
      {BOARD_STATUSES.filter((status) => status !== task.status).map(
        (status) => (
          <ContextMenuItem key={status} onClick={() => onMove(status)}>
            Move to {STATUS_LABEL[status]}
          </ContextMenuItem>
        ),
      )}
      <ContextMenuItem onClick={onDiscard}>Discard</ContextMenuItem>
    </>
  )
}
