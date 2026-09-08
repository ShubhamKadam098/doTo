import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addWeeksToKey,
  startOfWeekKey,
  todayKey,
  weekDayKeys,
} from '../../lib/date'
import { applyFilter, tasksForDate } from '../../lib/tasks'
import { withViewTransition } from '../../lib/viewTransition'
import { useTaskStore } from '../tasks/TaskStoreContext'
import {
  MIN_ROWS,
  PlannerContext,
  type DayModel,
  type FocusTarget,
  type PlannerValue,
} from './PlannerContext'
import type { Filter, Priority, Task } from '../../types/task'

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, canUndo, canRedo } = useTaskStore()
  const today = todayKey()

  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(today))
  const [filter, setFilter] = useState<Filter>('all')
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const [editing, setEditing] = useState(false)

  const days = useMemo<DayModel[]>(
    () =>
      weekDayKeys(weekStart).map((date) => ({
        date,
        tasks: applyFilter(tasksForDate(state.tasks, date), filter),
        isToday: date === today,
      })),
    [weekStart, state.tasks, filter, today],
  )

  // The alignment rule: every column renders the same number of rows, grown
  // from the busiest visible day and never below the ten-row floor.
  const rowCount = useMemo(
    () => Math.max(MIN_ROWS, ...days.map((day) => day.tasks.length + 1)),
    [days],
  )

  // Keeps one row tabbable so the grid is reachable with the Tab key.
  const defaultFocus = useMemo<FocusTarget>(
    () => ({
      date: days.some((day) => day.isToday) ? today : days[0].date,
      row: 0,
    }),
    [days, today],
  )

  /*
   * A blank row is identified by its position, so deleting a task above one
   * renumbers it and React rebuilds the editor from scratch. Keeping the text
   * out here means the rebuilt editor picks up where the old one left off.
   */
  const draftRef = useRef<string | null>(null)
  const readDraft = useCallback(() => draftRef.current, [])
  const writeDraft = useCallback((value: string | null) => {
    draftRef.current = value
  }, [])

  const focusSlot = useCallback(
    (target: FocusTarget | null, startEditing = false) => {
      setFocus(target)
      setEditing(target !== null && startEditing)
    },
    [],
  )

  const moveFocus = useCallback(
    (rowDelta: number, dayDelta: number) => {
      setFocus((current) => {
        const base = current ?? { date: days[0]?.date ?? weekStart, row: 0 }
        const dayIndex = days.findIndex((day) => day.date === base.date)
        const nextDayIndex = Math.min(
          days.length - 1,
          Math.max(0, (dayIndex === -1 ? 0 : dayIndex) + dayDelta),
        )
        const nextRow = Math.min(rowCount - 1, Math.max(0, base.row + rowDelta))
        return { date: days[nextDayIndex].date, row: nextRow }
      })
      setEditing(false)
    },
    [days, rowCount, weekStart],
  )

  const shiftWeek = useCallback((delta: number) => {
    setWeekStart((current) => addWeeksToKey(current, delta))
    setFocus(null)
    setEditing(false)
  }, [])

  const goToToday = useCallback(() => {
    setWeekStart(startOfWeekKey(today))
    setFocus({ date: today, row: 0 })
    setEditing(false)
  }, [today])

  const revealTask = useCallback(
    (task: Task) => {
      setFilter((current) =>
        (current === 'active' && task.completed) ||
        (current === 'completed' && !task.completed)
          ? 'all'
          : current,
      )
      setWeekStart(startOfWeekKey(task.date))
      const row = tasksForDate(state.tasks, task.date).findIndex(
        (candidate) => candidate.id === task.id,
      )
      setFocus({ date: task.date, row: Math.max(0, row) })
      setEditing(false)
    },
    [state.tasks],
  )

  const createTask = useCallback(
    (date: string, title: string) => dispatch({ type: 'create', date, title }),
    [dispatch],
  )
  const renameTask = useCallback(
    (id: string, title: string) => {
      const run = () => dispatch({ type: 'rename', id, title })
      // An emptied title deletes the task, so the list closes up the same way.
      if (title.trim().length === 0) withViewTransition(run)
      else run()
    },
    [dispatch],
  )
  const removeTask = useCallback(
    (id: string) => {
      // Focus is a position, so losing a row above it would otherwise leave an
      // open editor pointing at whatever slid into its place.
      const removedRow = tasksForDate(state.tasks, focus?.date ?? '').findIndex(
        (task) => task.id === id,
      )

      // Animated so the rows below close the gap rather than jumping into it.
      withViewTransition(() => {
        dispatch({ type: 'delete', id })
        if (removedRow >= 0) {
          setFocus((current) =>
            current && current.row > removedRow
              ? { ...current, row: current.row - 1 }
              : current,
          )
        }
      })
    },
    [dispatch, focus?.date, state.tasks],
  )
  const duplicateTask = useCallback(
    (id: string) => dispatch({ type: 'duplicate', id }),
    [dispatch],
  )
  const toggleTask = useCallback(
    (id: string) => dispatch({ type: 'toggle', id }),
    [dispatch],
  )
  const setPriority = useCallback(
    (id: string, priority: Priority) =>
      dispatch({ type: 'setPriority', id, priority }),
    [dispatch],
  )
  const relocateTask = useCallback(
    (id: string, toDate: string, toIndex: number) =>
      dispatch({ type: 'move', id, toDate, toIndex }),
    [dispatch],
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [dispatch])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [dispatch])

  const value = useMemo<PlannerValue>(
    () => ({
      today,
      weekStart,
      days,
      rowCount,
      filter,
      focus,
      defaultFocus,
      editing,
      allTasks: state.tasks,
      canUndo,
      canRedo,
      setFilter,
      shiftWeek,
      goToToday,
      revealTask,
      focusSlot,
      setEditing,
      moveFocus,
      readDraft,
      writeDraft,
      createTask,
      renameTask,
      removeTask,
      duplicateTask,
      toggleTask,
      setPriority,
      relocateTask,
      undo,
      redo,
    }),
    [
      today,
      weekStart,
      days,
      rowCount,
      filter,
      focus,
      defaultFocus,
      editing,
      state.tasks,
      canUndo,
      canRedo,
      shiftWeek,
      goToToday,
      revealTask,
      focusSlot,
      moveFocus,
      readDraft,
      writeDraft,
      createTask,
      renameTask,
      removeTask,
      duplicateTask,
      toggleTask,
      setPriority,
      relocateTask,
      undo,
      redo,
    ],
  )

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  )
}
