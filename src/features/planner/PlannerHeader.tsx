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
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 pt-5 pb-6 sm:gap-x-6 sm:gap-y-4 sm:px-10 sm:pt-10 sm:pb-14">
      <h1 className="mr-auto text-2xl font-bold tracking-[-0.035em] sm:text-[2.5rem]">
        {formatWeekTitle(planner.weekStart)}
      </h1>

      {/* Filters wrap to a line of their own before the week controls overflow. */}
      <div
        role="radiogroup"
        aria-label="Filter tasks"
        className="order-last flex w-full items-center gap-0.5 sm:order-none sm:w-auto sm:gap-1"
      >
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            role="radio"
            aria-checked={planner.filter === filter}
            onClick={() => planner.setFilter(filter)}
            className={`rounded-full px-2.5 py-1.5 text-[0.8125rem] transition-colors sm:px-3 sm:text-sm ${
              planner.filter === filter
                ? 'bg-elevated text-text'
                : 'text-muted hover:text-text'
            }`}
          >
            {FILTER_LABEL[filter]}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <IconButton
          label="Search tasks (Ctrl+K)"
          onClick={onOpenSearch}
          className="bg-elevated text-text"
        >
          <SearchIcon />
        </IconButton>

        <button
          type="button"
          onClick={planner.goToToday}
          className="rounded-full px-2.5 py-1.5 text-[0.8125rem] text-muted transition-colors hover:text-text sm:px-3 sm:text-sm"
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
