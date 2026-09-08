import { DayColumn } from './DayColumn'
import { usePlanner } from './PlannerContext'

/**
 * Desktop planner: five weekday columns, with Saturday and Sunday stacked in
 * a sixth so the whole week fits without squeezing the working days.
 */
export function WeekGrid() {
  const planner = usePlanner()
  const weekdays = planner.days.slice(0, 5)
  const [saturday, sunday] = planner.days.slice(5)

  return (
    <div className="grid grid-cols-6 gap-x-6 px-6 pb-24 sm:px-10 lg:gap-x-8">
      {weekdays.map((day) => (
        <DayColumn key={day.date} day={day} />
      ))}

      <div className="flex min-w-0 flex-col">
        <DayColumn day={saturday} />
        <DayColumn day={sunday} stacked />
      </div>
    </div>
  )
}
