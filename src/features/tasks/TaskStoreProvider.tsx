import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { useReconcileDay } from '../../hooks/useReconcileDay'
import { STORAGE_VERSION, load, save } from '../../lib/storage'
import { TaskStoreContext } from './TaskStoreContext'
import { taskReducer, type TaskState } from './taskReducer'

function hydrate(): TaskState {
  const { state } = load()
  return {
    tasks: state.tasks,
    lastRolloverDate: state.lastRolloverDate,
    past: [],
    future: [],
  }
}

export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, undefined, hydrate)

  useEffect(() => {
    save({
      version: STORAGE_VERSION,
      tasks: state.tasks,
      lastRolloverDate: state.lastRolloverDate,
    })
  }, [state.tasks, state.lastRolloverDate])

  useReconcileDay((today) => dispatch({ type: 'rollover', today }))

  const value = useMemo(
    () => ({
      state,
      dispatch,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state],
  )

  return (
    <TaskStoreContext.Provider value={value}>
      {children}
    </TaskStoreContext.Provider>
  )
}
