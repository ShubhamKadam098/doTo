import { describe, expect, it } from 'vitest'
import { rollover } from '../rollover'
import { addTask, setStatus, tasksForDate, updateTask } from '../tasks'
import type { Task } from '../../types/task'

const TODAY = '2026-09-06'

function build(
  entries: Array<{ title: string; date: string; status?: Task['status'] }>,
): Task[] {
  let tasks: Task[] = []
  for (const entry of entries) {
    const result = addTask(tasks, { title: entry.title, date: entry.date })!
    tasks = entry.status
      ? setStatus(result.tasks, result.task.id, entry.status)
      : result.tasks
  }
  return tasks
}

describe('rollover', () => {
  it('moves an incomplete task from yesterday to today', () => {
    const tasks = build([{ title: 'A', date: '2026-09-05' }])
    const { tasks: rolled, movedIds } = rollover(tasks, TODAY)

    expect(movedIds).toEqual([tasks[0].id])
    expect(rolled[0].date).toBe(TODAY)
  })

  it('moves a task from several days ago', () => {
    const tasks = build([{ title: 'A', date: '2026-08-20' }])
    expect(rollover(tasks, TODAY).tasks[0].date).toBe(TODAY)
  })

  it('leaves a completed task on its original date', () => {
    const tasks = build([
      { title: 'A', date: '2026-09-05' },
      { title: 'B', date: '2026-09-05', status: 'done' },
    ])
    const { tasks: rolled } = rollover(tasks, TODAY)

    expect(rolled.find((t) => t.title === 'A')!.date).toBe(TODAY)
    expect(rolled.find((t) => t.title === 'B')!.date).toBe('2026-09-05')
  })

  it('leaves future tasks untouched', () => {
    const tasks = build([{ title: 'A', date: '2026-09-20' }])
    const result = rollover(tasks, TODAY)
    expect(result.movedIds).toEqual([])
    expect(result.tasks).toBe(tasks)
  })

  it('leaves tasks already on today untouched', () => {
    const tasks = build([{ title: 'A', date: TODAY }])
    expect(rollover(tasks, TODAY).movedIds).toEqual([])
  })

  it('moves every old task and never duplicates one', () => {
    const tasks = build([
      { title: 'A', date: '2026-09-01' },
      { title: 'B', date: '2026-09-02' },
      { title: 'C', date: '2026-09-03' },
      { title: 'D', date: '2026-09-04', status: 'done' },
    ])
    const { tasks: rolled, movedIds } = rollover(tasks, TODAY)

    expect(rolled).toHaveLength(4)
    expect(new Set(rolled.map((t) => t.id)).size).toBe(4)
    expect(movedIds).toHaveLength(3)
    expect(tasksForDate(rolled, TODAY).map((t) => t.title)).toEqual([
      'A',
      'B',
      'C',
    ])
  })

  it('preserves id, title, completion state and priority', () => {
    let tasks = build([{ title: 'Keep me', date: '2026-09-01' }])
    tasks = updateTask(tasks, tasks[0].id, { priority: 'high' })
    const before = tasks[0]

    const after = rollover(tasks, TODAY).tasks[0]
    expect(after.id).toBe(before.id)
    expect(after.title).toBe(before.title)
    expect(after.status).toBe('todo')
    expect(after.priority).toBe('high')
    expect(after.createdAt).toBe(before.createdAt)
  })

  it('appends rolled tasks after the ones already on today', () => {
    const tasks = build([
      { title: 'Existing', date: TODAY },
      { title: 'Old', date: '2026-09-04' },
    ])
    const { tasks: rolled } = rollover(tasks, TODAY)
    expect(tasksForDate(rolled, TODAY).map((t) => t.title)).toEqual([
      'Existing',
      'Old',
    ])
  })

  it('closes order gaps left behind on emptied days', () => {
    const tasks = build([
      { title: 'Done', date: '2026-09-05', status: 'done' },
      { title: 'Open', date: '2026-09-05' },
    ])
    const { tasks: rolled } = rollover(tasks, TODAY)
    expect(tasksForDate(rolled, '2026-09-05').map((t) => t.order)).toEqual([0])
  })

  it('is idempotent when run twice', () => {
    const tasks = build([{ title: 'A', date: '2026-09-01' }])
    const first = rollover(tasks, TODAY)
    const second = rollover(first.tasks, TODAY)
    expect(second.movedIds).toEqual([])
    expect(second.tasks).toHaveLength(1)
  })

  it('carries in-progress and waiting tasks with their status', () => {
    const tasks = build([
      { title: 'Doing', date: '2026-09-04', status: 'in_progress' },
      { title: 'Blocked', date: '2026-09-04', status: 'waiting' },
      { title: 'Binned', date: '2026-09-04', status: 'discarded' },
    ])
    const { tasks: rolled, movedIds } = rollover(tasks, TODAY)

    expect(movedIds).toHaveLength(2)
    const byTitle = (title: string) => rolled.find((t) => t.title === title)!
    expect(byTitle('Doing')).toMatchObject({ date: TODAY, status: 'in_progress' })
    expect(byTitle('Blocked')).toMatchObject({ date: TODAY, status: 'waiting' })
    expect(byTitle('Binned').date).toBe('2026-09-04')
    expect(byTitle('Doing').boardOrder).toBe(tasks.find((t) => t.title === 'Doing')!.boardOrder)
  })
})
