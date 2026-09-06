import { DayColumn } from './DayColumn'
import { usePlanner } from './PlannerContext'

/** Desktop planner: seven aligned day columns for the visible week. */
export function WeekGrid() {
  const planner = usePlanner()

  return (
    <div className="grid grid-cols-7 gap-x-4 px-6 pb-24 sm:px-10 lg:gap-x-6">
      {planner.days.map((day) => (
        <DayColumn key={day.date} day={day} rowCount={planner.rowCount} />
      ))}
    </div>
  )
}
