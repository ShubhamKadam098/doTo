import { useCallback, useMemo, useState } from 'react'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { Board } from '../board/Board'
import { SearchDialog } from '../search/SearchDialog'
import { MobileWeek } from './MobileWeek'
import { PlannerDnd } from './PlannerDnd'
import { PlannerHeader } from './PlannerHeader'
import { usePlanner } from './PlannerContext'
import { WeekGrid } from './WeekGrid'

export function Planner() {
  const planner = usePlanner()
  const { view, setView } = planner
  const [searchOpen, setSearchOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 900px)')

  const focusNewTask = useCallback(() => {
    const date =
      planner.focus?.date ??
      (planner.days.some((day) => day.isToday)
        ? planner.today
        : planner.days[0].date)
    // Rows render from the filtered list, so hidden tasks must not be counted.
    const row = planner.days.find((day) => day.date === date)?.tasks.length ?? 0
    planner.focusSlot({ date, row }, true)
  }, [planner])

  useGlobalShortcuts(
    useMemo(
      () => ({
        onSearch: () => setSearchOpen((open) => !open),
        onUndo: planner.undo,
        onRedo: planner.redo,
        onToday: planner.goToToday,
        onNewTask:
          view === 'week' && planner.filter !== 'discarded'
            ? focusNewTask
            : () => {},
        onToggleView: () =>
          setView(view === 'week' ? 'board' : 'week'),
      }),
      [
        planner.undo,
        planner.redo,
        planner.goToToday,
        view,
        planner.filter,
        setView,
        focusNewTask,
      ],
    ),
    !searchOpen,
  )

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#planner"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-elevated focus:px-3 focus:py-2"
      >
        Skip to planner
      </a>

      <PlannerHeader onOpenSearch={() => setSearchOpen(true)} />

      {/* Fills the window so board columns can run to the bottom of it. */}
      <main id="planner" className="flex flex-1 flex-col">
        {planner.view === 'board' ? (
          <>
            <h2 className="sr-only">
              Board. Arrow keys move between cards, Alt with an arrow moves the
              card, Enter opens it.
            </h2>
            <Board isDesktop={isDesktop} />
          </>
        ) : (
          <>
            <h2 className="sr-only">
              Weekly planner. Arrow keys move between rows and days, Enter edits,
              Space completes, Delete removes.
            </h2>
            <PlannerDnd>{isDesktop ? <WeekGrid /> : <MobileWeek />}</PlannerDnd>
          </>
        )}
      </main>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
