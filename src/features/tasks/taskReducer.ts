import { rollover } from '../../lib/rollover'
import {
  addTask,
  deleteTask,
  duplicateTask,
  moveTask,
  toggleCompleted,
  updateTask,
} from '../../lib/tasks'
import type { Priority, Task } from '../../types/task'

const HISTORY_LIMIT = 100

export interface Snapshot {
  tasks: Task[]
  lastRolloverDate: string | null
}

export interface TaskState extends Snapshot {
  past: Snapshot[]
  future: Snapshot[]
}

export type TaskAction =
  | { type: 'hydrate'; tasks: Task[]; lastRolloverDate: string | null }
  | { type: 'create'; date: string; title: string; priority?: Priority }
  | { type: 'rename'; id: string; title: string }
  | { type: 'delete'; id: string }
  | { type: 'duplicate'; id: string }
  | { type: 'toggle'; id: string }
  | { type: 'setPriority'; id: string; priority: Priority }
  | { type: 'move'; id: string; toDate: string; toIndex: number }
  | { type: 'rollover'; today: string }
  | { type: 'undo' }
  | { type: 'redo' }

export const initialTaskState: TaskState = {
  tasks: [],
  lastRolloverDate: null,
  past: [],
  future: [],
}

function snapshot(state: TaskState): Snapshot {
  return { tasks: state.tasks, lastRolloverDate: state.lastRolloverDate }
}

/** Commits a mutation as a single undoable step. */
function commit(state: TaskState, next: Partial<Snapshot>): TaskState {
  const merged = { ...snapshot(state), ...next }
  if (merged.tasks === state.tasks) {
    return merged.lastRolloverDate === state.lastRolloverDate
      ? state
      : { ...state, lastRolloverDate: merged.lastRolloverDate }
  }
  return {
    ...merged,
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
    future: [],
  }
}

export function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'hydrate':
      return {
        tasks: action.tasks,
        lastRolloverDate: action.lastRolloverDate,
        past: [],
        future: [],
      }

    case 'create': {
      const result = addTask(state.tasks, {
        title: action.title,
        date: action.date,
        priority: action.priority,
      })
      return result ? commit(state, { tasks: result.tasks }) : state
    }

    case 'rename': {
      const title = action.title.trim()
      const target = state.tasks.find((task) => task.id === action.id)
      if (!target) return state
      if (title.length === 0) {
        return commit(state, { tasks: deleteTask(state.tasks, action.id) })
      }
      if (title === target.title) return state
      return commit(state, {
        tasks: updateTask(state.tasks, action.id, { title }),
      })
    }

    case 'delete':
      return commit(state, { tasks: deleteTask(state.tasks, action.id) })

    case 'duplicate': {
      const tasks = duplicateTask(state.tasks, action.id)
      return tasks === state.tasks ? state : commit(state, { tasks })
    }

    case 'toggle':
      return commit(state, { tasks: toggleCompleted(state.tasks, action.id) })

    case 'setPriority': {
      const target = state.tasks.find((task) => task.id === action.id)
      if (!target || target.priority === action.priority) return state
      return commit(state, {
        tasks: updateTask(state.tasks, action.id, {
          priority: action.priority,
        }),
      })
    }

    case 'move':
      return commit(state, {
        tasks: moveTask(state.tasks, action.id, action.toDate, action.toIndex),
      })

    case 'rollover': {
      const result = rollover(state.tasks, action.today)
      if (result.movedIds.length === 0) {
        return state.lastRolloverDate === action.today
          ? state
          : { ...state, lastRolloverDate: action.today }
      }
      return commit(state, {
        tasks: result.tasks,
        lastRolloverDate: action.today,
      })
    }

    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        ...previous,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
      }
    }

    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return {
        ...next,
        past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
        future: rest,
      }
    }

    default:
      return state
  }
}
