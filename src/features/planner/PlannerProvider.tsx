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
import { applyFilter, isOpen, tasksForDate } from '../../lib/tasks'
import { loadView, saveView, type View } from '../../lib/viewPreference'
import { withViewTransition } from '../../lib/viewTransition'
import { useTaskStore } from '../tasks/TaskStoreContext'
import {
  MIN_ROWS,
  WEEKEND_MIN_ROWS,
  PlannerContext,
  type DayModel,
  type FocusTarget,
  type PlannerValue,
} from './PlannerContext'
import type { Filter, Priority, Status, Task } from '../../types/task'

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, canUndo, canRedo } = useTaskStore()
  const today = todayKey()

  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(today))
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setViewState] = useState<View>(loadView)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const [editing, setEditing] = useState(false)

  const days = useMemo<DayModel[]>(() => {
    const week = weekDayKeys(weekStart).map((date) => ({
      date,
      tasks: applyFilter(tasksForDate(state.tasks, date), filter),
      isToday: date === today,
    }))

    const weekdays = week.slice(0, 5)
    const [saturday, sunday] = week.slice(5)

    /*
     * The alignment rule: Monday to Friday all render the same number of rows,
     * grown from the busiest weekday and never below the ten-row floor.
     * Saturday and Sunday stack inside the sixth column, so their rows plus
     * the one Sunday's header stands in for have to add up to that height.
     */
    const saturdayRows = Math.max(WEEKEND_MIN_ROWS, saturday.tasks.length + 1)
    const rowCount = Math.max(
      MIN_ROWS,
      ...weekdays.map((day) => day.tasks.length + 1),
      saturdayRows + sunday.tasks.length + 2,
    )

    // Saturday takes the rows it needs; Sunday absorbs the rest so the column
    // ends level with the weekdays beside it.
    return [
      ...weekdays.map((day) => ({ ...day, rows: rowCount })),
      { ...saturday, rows: saturdayRows },
      { ...sunday, rows: rowCount - saturdayRows - 1 },
    ]
  }, [weekStart, state.tasks, filter, today])

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
        // Each day owns its height, so crossing into the weekend clamps.
        const nextDay = days[nextDayIndex]
        const nextRow = Math.min(
          nextDay.rows - 1,
          Math.max(0, base.row + rowDelta),
        )
        return { date: nextDay.date, row: nextRow }
      })
      setEditing(false)
    },
    [days, weekStart],
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

  const setView = useCallback((next: View) => {
    setViewState(next)
    saveView(next)
    setFocus(null)
    setEditing(false)
  }, [])

  const revealTask = useCallback(
    (task: Task) => {
      setViewState('week')
      saveView('week')
      // Rows are numbered within the filter the week ends up on.
      let nextFilter = filter
      if (task.status === 'discarded') nextFilter = 'discarded'
      else if (
        filter === 'discarded' ||
        (filter === 'active' && !isOpen(task)) ||
        (filter === 'completed' && task.status !== 'done')
      ) {
        nextFilter = 'all'
      }
      setFilter(nextFilter)
      setWeekStart(startOfWeekKey(task.date))
      const visible = applyFilter(tasksForDate(state.tasks, task.date), nextFilter)
      const row = visible.findIndex(
        (candidate) => candidate.id === task.id,
      )
      setFocus({ date: task.date, row: Math.max(0, row) })
      setEditing(false)
    },
    [state.tasks, filter],
  )

  const createTask = useCallback(
    (date: string, title: string, status?: Status) =>
      dispatch({ type: 'create', date, title, status }),
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
  /** Runs a change that takes `id` out of its day's visible rows. */
  const takeOutOfView = useCallback(
    (id: string, run: () => void) => {
      // Focus is a position, so losing a row above it would otherwise leave an
      // open editor pointing at whatever slid into its place.
      const removedRow = (
        days.find((day) => day.date === focus?.date)?.tasks ?? []
      ).findIndex((task) => task.id === id)

      // Animated so the rows below close the gap rather than jumping into it.
      withViewTransition(() => {
        run()
        if (removedRow >= 0) {
          setFocus((current) =>
            current && current.row > removedRow
              ? { ...current, row: current.row - 1 }
              : current,
          )
        }
      })
    },
    [focus?.date, days],
  )
  const removeTask = useCallback(
    (id: string) => takeOutOfView(id, () => dispatch({ type: 'delete', id })),
    [dispatch, takeOutOfView],
  )
  const discardTask = useCallback(
    (id: string) =>
      takeOutOfView(id, () =>
        dispatch({ type: 'setStatus', id, status: 'discarded' }),
      ),
    [dispatch, takeOutOfView],
  )
  const restoreTask = useCallback(
    (id: string) =>
      takeOutOfView(id, () => dispatch({ type: 'setStatus', id, status: 'todo' })),
    [dispatch, takeOutOfView],
  )
  const setStatus = useCallback(
    (id: string, status: Status, toIndex?: number) =>
      dispatch({ type: 'setStatus', id, status, toIndex }),
    [dispatch],
  )
  const reorderOnBoard = useCallback(
    (id: string, toIndex: number) =>
      dispatch({ type: 'reorderOnBoard', id, toIndex }),
    [dispatch],
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
      filter,
      view,
      focus,
      defaultFocus,
      editing,
      allTasks: state.tasks,
      canUndo,
      canRedo,
      setFilter,
      setView,
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
      setStatus,
      reorderOnBoard,
      discardTask,
      restoreTask,
      undo,
      redo,
    }),
    [
      today,
      weekStart,
      days,
      filter,
      view,
      focus,
      defaultFocus,
      editing,
      state.tasks,
      canUndo,
      canRedo,
      setView,
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
      setStatus,
      reorderOnBoard,
      discardTask,
      restoreTask,
      undo,
      redo,
    ],
  )

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  )
}
