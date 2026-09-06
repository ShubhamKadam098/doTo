import { createContext, useContext } from 'react'
import type { TaskAction, TaskState } from './taskReducer'

export interface TaskStore {
  state: TaskState
  dispatch: (action: TaskAction) => void
  canUndo: boolean
  canRedo: boolean
}

export const TaskStoreContext = createContext<TaskStore | null>(null)

export function useTaskStore(): TaskStore {
  const store = useContext(TaskStoreContext)
  if (!store) {
    throw new Error('useTaskStore must be used inside <TaskStoreProvider>')
  }
  return store
}
