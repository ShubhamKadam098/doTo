import { IconButton } from '../../components/IconButton'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from '../../components/icons'
import { formatWeekTitle } from '../../lib/date'
import { usePlanner } from './PlannerContext'
import { FILTERS, type Filter } from '../../types/task'

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  active: 'Active',
  completed: 'Completed',
}

export function PlannerHeader({ onOpenSearch }: { onOpenSearch: () => void }) {
  const planner = usePlanner()

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-6 pt-6 pb-8 sm:px-10 sm:pt-10 sm:pb-14">
      <h1 className="text-[1.75rem] font-bold tracking-tight sm:text-[2.5rem]">
        {formatWeekTitle(planner.weekStart)}
      </h1>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          role="radiogroup"
          aria-label="Filter tasks"
          className="mr-1 flex items-center gap-1"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              role="radio"
              aria-checked={planner.filter === filter}
              onClick={() => planner.setFilter(filter)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                planner.filter === filter
                  ? 'bg-elevated text-text'
                  : 'text-muted hover:text-text'
              }`}
            >
              {FILTER_LABEL[filter]}
            </button>
          ))}
        </div>

        <IconButton label="Search tasks (Ctrl+K)" onClick={onOpenSearch}>
          <SearchIcon />
        </IconButton>

        <button
          type="button"
          onClick={planner.goToToday}
          className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          Today
        </button>

        <IconButton
          label="Previous week"
          variant="solid"
          onClick={() => planner.shiftWeek(-1)}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </IconButton>
        <IconButton
          label="Next week"
          variant="solid"
          onClick={() => planner.shiftWeek(1)}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </IconButton>
      </div>
    </header>
  )
}
