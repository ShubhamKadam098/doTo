import { describe, expect, it } from 'vitest'
import { addTask, moveTask, tasksForDate } from '../../../lib/tasks'
import { resolveDrop, type DropOver } from '../resolveDrop'
import type { Task } from '../../../types/task'

const MON = '2026-09-07'
const TUE = '2026-09-08'

/** Builds a board from `{ day: titles }`, in the order given. */
function board(days: Record<string, string[]>): Task[] {
  let tasks: Task[] = []
  for (const [date, titles] of Object.entries(days)) {
    for (const title of titles) {
      tasks = addTask(tasks, { title, date })!.tasks
    }
  }
  return tasks
}

function idOf(tasks: Task[], title: string): string {
  return tasks.find((task) => task.title === title)!.id
}

describe('resolveDrop', () => {
  /*
   * Blank slots pad every column to a uniform height, so they are what the
   * pointer is usually over. They name a day but no task.
   */
  it('appends to the day when dropped on a blank slot', () => {
    const tasks = board({ [MON]: ['Alpha'], [TUE]: ['Beta'] })

    const drop = resolveDrop(tasks, idOf(tasks, 'Alpha'), {
      id: `slot:${TUE}:3`,
      date: TUE,
    })

    expect(drop).toEqual({ toDate: TUE, toIndex: 1 })
  })

  it('appends to the day when dropped on the column itself', () => {
    const tasks = board({ [MON]: ['Alpha'], [TUE]: ['Beta', 'Gamma'] })

    const drop = resolveDrop(tasks, idOf(tasks, 'Alpha'), { id: `day:${TUE}` })

    expect(drop).toEqual({ toDate: TUE, toIndex: 2 })
  })

  it('takes the target position when dropped on a task in another day', () => {
    const tasks = board({ [MON]: ['Alpha'], [TUE]: ['Beta', 'Gamma'] })

    const drop = resolveDrop(tasks, idOf(tasks, 'Alpha'), {
      id: idOf(tasks, 'Gamma'),
      date: TUE,
    })

    expect(drop).toEqual({ toDate: TUE, toIndex: 1 })
  })

  it('reorders within a day, landing after a task dragged downwards', () => {
    const tasks = board({ [MON]: ['Alpha', 'Beta', 'Gamma'] })

    const drop = resolveDrop(tasks, idOf(tasks, 'Alpha'), {
      id: idOf(tasks, 'Gamma'),
      date: MON,
    })

    expect(drop).toEqual({ toDate: MON, toIndex: 2 })
  })

  it('ignores a drop onto the dragged task itself', () => {
    const tasks = board({ [MON]: ['Alpha'] })
    const alpha = idOf(tasks, 'Alpha')

    expect(resolveDrop(tasks, alpha, { id: alpha, date: MON })).toBeNull()
  })

  it('ignores a slot that names no day', () => {
    const tasks = board({ [MON]: ['Alpha'] })

    expect(
      resolveDrop(tasks, idOf(tasks, 'Alpha'), { id: 'slot:whatever:1' }),
    ).toBeNull()
  })

  it('ignores a drag whose task no longer exists', () => {
    const tasks = board({ [MON]: ['Alpha'] })

    expect(resolveDrop(tasks, 'gone', { id: `day:${TUE}` })).toBeNull()
  })

  /*
   * The planner focuses a slot by position, so after a drop it needs the row
   * the task actually landed on. That only works while the resolved index and
   * the index `moveTask` settles on stay the same number.
   */
  describe('the resolved index is the row the task lands on', () => {
    const cases: Array<[string, Record<string, string[]>, string, DropOver]> = [
      ['blank slot', { [MON]: ['Alpha'], [TUE]: ['Beta'] }, 'Alpha', { id: `slot:${TUE}:4`, date: TUE }],
      ['empty day', { [MON]: ['Alpha'] }, 'Alpha', { id: `slot:${TUE}:0`, date: TUE }],
      ['day column', { [MON]: ['Alpha'], [TUE]: ['Beta', 'Gamma'] }, 'Alpha', { id: `day:${TUE}` }],
      ['task in another day', { [MON]: ['Alpha'], [TUE]: ['Beta', 'Gamma'] }, 'Alpha', { id: 'Gamma', date: TUE }],
      ['downwards in a day', { [MON]: ['Alpha', 'Beta', 'Gamma'] }, 'Alpha', { id: 'Gamma', date: MON }],
      ['upwards in a day', { [MON]: ['Alpha', 'Beta', 'Gamma'] }, 'Gamma', { id: 'Alpha', date: MON }],
    ]

    it.each(cases)('%s', (_label, days, draggedTitle, over) => {
      const tasks = board(days)
      const draggedId = idOf(tasks, draggedTitle)
      const resolvedOver = {
        ...over,
        id: over.id.includes(':') ? over.id : idOf(tasks, over.id),
      }

      const drop = resolveDrop(tasks, draggedId, resolvedOver)!
      expect(drop).not.toBeNull()

      const after = moveTask(tasks, draggedId, drop.toDate, drop.toIndex)
      expect(tasksForDate(after, drop.toDate)[drop.toIndex]?.id).toBe(draggedId)
    })
  })
})
