import type { Task } from '../types/task'

const MAX_RESULTS = 40

/**
 * Searches every stored task, not only the visible week. Newest days first so
 * recent work surfaces before old history.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []
  return tasks
    .filter((task) => task.title.toLowerCase().includes(needle))
    .sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1))
    .slice(0, MAX_RESULTS)
}
