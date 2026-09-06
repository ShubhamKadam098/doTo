import { Planner } from './features/planner/Planner'
import { PlannerProvider } from './features/planner/PlannerProvider'
import { TaskStoreProvider } from './features/tasks/TaskStoreProvider'

export default function App() {
  return (
    <TaskStoreProvider>
      <PlannerProvider>
        <Planner />
      </PlannerProvider>
    </TaskStoreProvider>
  )
}
