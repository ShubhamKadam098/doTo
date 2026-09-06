import { useCallback, useMemo, useState } from 'react'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { tasksForDate } from '../../lib/tasks'
import { SearchDialog } from '../search/SearchDialog'
import { MobileWeek } from './MobileWeek'
import { PlannerDnd } from './PlannerDnd'
import { PlannerHeader } from './PlannerHeader'
import { usePlanner } from './PlannerContext'
import { WeekGrid } from './WeekGrid'

export function Planner() {
  const planner = usePlanner()
  const [searchOpen, setSearchOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 900px)')

  const focusNewTask = useCallback(() => {
    const date =
      planner.focus?.date ??
      (planner.days.some((day) => day.isToday)
        ? planner.today
        : planner.days[0].date)
    const row = tasksForDate(planner.allTasks, date).length
    planner.focusSlot({ date, row }, true)
  }, [planner])

  useGlobalShortcuts(
    useMemo(
      () => ({
        onSearch: () => setSearchOpen((open) => !open),
        onUndo: planner.undo,
        onRedo: planner.redo,
        onToday: planner.goToToday,
        onNewTask: focusNewTask,
      }),
      [planner.undo, planner.redo, planner.goToToday, focusNewTask],
    ),
    !searchOpen,
  )

  return (
    <div className="min-h-screen">
      <a
        href="#planner"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-elevated focus:px-3 focus:py-2"
      >
        Skip to planner
      </a>

      <PlannerHeader onOpenSearch={() => setSearchOpen(true)} />

      <main id="planner">
        <h2 className="sr-only">
          Weekly planner. Arrow keys move between rows and days, Enter edits,
          Space completes, Delete removes.
        </h2>
        <PlannerDnd>{isDesktop ? <WeekGrid /> : <MobileWeek />}</PlannerDnd>
      </main>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
