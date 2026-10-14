import { describe, expect, it } from 'vitest'
import {
  addTask,
  applyFilter,
  deleteTask,
  duplicateTask,
  moveTask,
  normalizeBoardOrders,
  normalizeOrders,
  reorderOnBoard,
  setStatus,
  tasksForDate,
  toggleCompleted,
  updateTask,
} from '../tasks'
import type { Task } from '../../types/task'

function seed(titles: string[], date = '2026-09-01'): Task[] {
  let tasks: Task[] = []
  for (const title of titles) {
    const result = addTask(tasks, { title, date })
    expect(result).not.toBeNull()
    tasks = result!.tasks
  }
  return tasks
}

describe('task CRUD', () => {
  it('creates a task with defaults and appended order', () => {
    const tasks = seed(['ChatBot', 'PDF Layout'])
    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({
      title: 'ChatBot',
      date: '2026-09-01',
      status: 'todo',
      priority: 'none',
      order: 0,
      boardOrder: 0,
    })
    expect(tasks[1].order).toBe(1)
    expect(tasks[1].boardOrder).toBe(1)
    expect(tasks[0].id).not.toBe(tasks[1].id)
  })

  it('trims titles and refuses empty ones', () => {
    const created = addTask([], { title: '  Spaced  ', date: '2026-09-01' })
    expect(created?.task.title).toBe('Spaced')
    expect(addTask([], { title: '   ', date: '2026-09-01' })).toBeNull()
  })

  it('edits a title without changing identity', () => {
    const tasks = seed(['ChatBot'])
    const edited = updateTask(tasks, tasks[0].id, { title: 'ChatBot v2' })
    expect(edited[0].id).toBe(tasks[0].id)
    expect(edited[0].title).toBe('ChatBot v2')
    expect(edited[0].createdAt).toBe(tasks[0].createdAt)
  })

  it('deletes a task and closes the order gap', () => {
    const tasks = seed(['a', 'b', 'c'])
    const remaining = deleteTask(tasks, tasks[1].id)
    expect(remaining.map((task) => task.title)).toEqual(['a', 'c'])
    expect(tasksForDate(remaining, '2026-09-01').map((t) => t.order)).toEqual([
      0, 1,
    ])
  })

  it('ignores deletes for unknown ids', () => {
    const tasks = seed(['a'])
    expect(deleteTask(tasks, 'missing')).toBe(tasks)
  })
})

describe('completion', () => {
  it('completes and reopens without moving the task', () => {
    const tasks = seed(['a'])
    const completed = toggleCompleted(tasks, tasks[0].id)
    expect(completed[0].status).toBe('done')
    expect(completed[0].date).toBe('2026-09-01')

    const reopened = toggleCompleted(completed, tasks[0].id)
    expect(reopened[0].status).toBe('todo')
  })

  it('completes an in-progress task and reopens it as todo', () => {
    let tasks = seed(['a'])
    tasks = setStatus(tasks, tasks[0].id, 'in_progress')
    tasks = toggleCompleted(tasks, tasks[0].id)
    expect(tasks[0].status).toBe('done')
    tasks = toggleCompleted(tasks, tasks[0].id)
    expect(tasks[0].status).toBe('todo')
  })

  it('leaves a discarded task alone', () => {
    let tasks = seed(['a'])
    tasks = setStatus(tasks, tasks[0].id, 'discarded')
    expect(toggleCompleted(tasks, tasks[0].id)).toBe(tasks)
  })

  it('keeps completed tasks visible under the default filter', () => {
    const tasks = toggleCompleted(seed(['a', 'b']), seed(['a', 'b'])[0].id)
    expect(applyFilter(tasks, 'all')).toHaveLength(2)
  })
})

describe('status', () => {
  const titles = (tasks: Task[], status: Task['status']) =>
    tasks
      .filter((task) => task.status === status)
      .sort((a, b) => a.boardOrder - b.boardOrder)
      .map((task) => task.title)

  it('appends to the bottom of the target column and closes the gap', () => {
    let tasks = seed(['a', 'b', 'c'])
    tasks = setStatus(tasks, tasks[0].id, 'waiting')
    tasks = setStatus(tasks, tasks[1].id, 'waiting')

    expect(titles(tasks, 'waiting')).toEqual(['a', 'b'])
    expect(titles(tasks, 'todo')).toEqual(['c'])
    expect(tasks.find((t) => t.title === 'c')!.boardOrder).toBe(0)
  })

  it('inserts at an index in the target column', () => {
    let tasks = seed(['a', 'b', 'c'])
    tasks = setStatus(tasks, tasks[0].id, 'waiting')
    tasks = setStatus(tasks, tasks[1].id, 'waiting')
    tasks = setStatus(tasks, tasks[2].id, 'waiting', 0)
    expect(titles(tasks, 'waiting')).toEqual(['c', 'a', 'b'])
  })

  it('reorders within the same column when given an index', () => {
    const tasks = seed(['a', 'b', 'c'])
    const moved = setStatus(tasks, tasks[0].id, 'todo', 2)
    expect(titles(moved, 'todo')).toEqual(['b', 'c', 'a'])
  })

  it('never touches date or day order', () => {
    const tasks = seed(['a', 'b'])
    const moved = setStatus(tasks, tasks[1].id, 'done', 0)
    const b = moved.find((t) => t.title === 'b')!
    expect(b.date).toBe('2026-09-01')
    expect(b.order).toBe(1)
  })

  it('returns the same array for a no-op', () => {
    const tasks = seed(['a', 'b'])
    expect(setStatus(tasks, tasks[0].id, 'todo')).toBe(tasks)
    expect(setStatus(tasks, tasks[0].id, 'todo', 0)).toBe(tasks)
    expect(setStatus(tasks, 'missing', 'done')).toBe(tasks)
  })

  it('deleting closes the column gap', () => {
    const tasks = seed(['a', 'b', 'c'])
    const remaining = deleteTask(tasks, tasks[0].id)
    expect(remaining.map((t) => t.boardOrder)).toEqual([0, 1])
  })

  it('normalizes board order per status', () => {
    const tasks = seed(['a', 'b']).map((task, index) => ({
      ...task,
      boardOrder: index === 0 ? 7 : 3,
    }))
    expect(normalizeBoardOrders(tasks).map((t) => t.boardOrder)).toEqual([1, 0])
  })
})

describe('filters', () => {
  it('shows all, active and completed without mutating data', () => {
    const tasks = seed(['a', 'b'])
    const withCompleted = toggleCompleted(tasks, tasks[0].id)

    expect(applyFilter(withCompleted, 'all')).toHaveLength(2)
    expect(applyFilter(withCompleted, 'active').map((t) => t.title)).toEqual([
      'b',
    ])
    expect(applyFilter(withCompleted, 'completed').map((t) => t.title)).toEqual([
      'a',
    ])
    expect(withCompleted).toHaveLength(2)
  })
})

describe('priority', () => {
  it('defaults to none and accepts every level', () => {
    let tasks = seed(['a'])
    expect(tasks[0].priority).toBe('none')
    for (const priority of ['low', 'medium', 'high', 'none'] as const) {
      tasks = updateTask(tasks, tasks[0].id, { priority })
      expect(tasks[0].priority).toBe(priority)
    }
  })
})

describe('dates', () => {
  it('keeps past, today and future tasks on their own days', () => {
    let tasks = seed(['past'], '2020-01-01')
    tasks = addTask(tasks, { title: 'today', date: '2026-09-06' })!.tasks
    tasks = addTask(tasks, { title: 'future', date: '2030-12-31' })!.tasks

    expect(tasksForDate(tasks, '2020-01-01')).toHaveLength(1)
    expect(tasksForDate(tasks, '2026-09-06')).toHaveLength(1)
    expect(tasksForDate(tasks, '2030-12-31')).toHaveLength(1)
  })

  it('orders independently per day', () => {
    let tasks = seed(['a', 'b'], '2026-09-01')
    tasks = addTask(tasks, { title: 'c', date: '2026-09-02' })!.tasks
    expect(tasksForDate(tasks, '2026-09-02')[0].order).toBe(0)
  })
})

describe('ordering', () => {
  it('reorders within a day', () => {
    const tasks = seed(['a', 'b', 'c'])
    const moved = moveTask(tasks, tasks[2].id, '2026-09-01', 0)
    expect(tasksForDate(moved, '2026-09-01').map((t) => t.title)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('moves a task between days, preserving identity and fields', () => {
    let tasks = seed(['a', 'b'])
    tasks = updateTask(tasks, tasks[0].id, { priority: 'high' })
    tasks = toggleCompleted(tasks, tasks[0].id)
    const target = tasks[0]

    const moved = moveTask(tasks, target.id, '2026-09-03', 0)
    const found = moved.find((task) => task.id === target.id)!

    expect(found.date).toBe('2026-09-03')
    expect(found.order).toBe(0)
    expect(found.title).toBe(target.title)
    expect(found.priority).toBe('high')
    expect(found.status).toBe('done')
    expect(found.createdAt).toBe(target.createdAt)
    expect(moved).toHaveLength(2)
    expect(tasksForDate(moved, '2026-09-01').map((t) => t.order)).toEqual([0])
  })

  it('clamps an out-of-range destination index', () => {
    const tasks = seed(['a', 'b'])
    const moved = moveTask(tasks, tasks[0].id, '2026-09-01', 99)
    expect(tasksForDate(moved, '2026-09-01').map((t) => t.title)).toEqual([
      'b',
      'a',
    ])
  })

  it('normalizes sparse orders into a dense sequence', () => {
    const tasks = seed(['a', 'b', 'c']).map((task, index) => ({
      ...task,
      order: index * 10,
    }))
    expect(normalizeOrders(tasks).map((t) => t.order)).toEqual([0, 1, 2])
  })
})

describe('board order', () => {
  it('reorders within the column without touching date, order or status', () => {
    const tasks = seed(['a', 'b', 'c'])
    const moved = reorderOnBoard(tasks, tasks[2].id, 0)
    const c = moved.find((t) => t.title === 'c')!
    expect(
      [...moved].sort((x, y) => x.boardOrder - y.boardOrder).map((t) => t.title),
    ).toEqual(['c', 'a', 'b'])
    expect(c).toMatchObject({ date: '2026-09-01', order: 2, status: 'todo' })
  })

  it('duplicates an open task into the same column, right under it', () => {
    let tasks = seed(['a', 'b'])
    tasks = setStatus(tasks, tasks[0].id, 'waiting')
    tasks = setStatus(tasks, tasks[1].id, 'waiting')
    tasks = duplicateTask(tasks, tasks[0].id)
    const waiting = tasks
      .filter((t) => t.status === 'waiting')
      .sort((x, y) => x.boardOrder - y.boardOrder)
    expect(waiting.map((t) => t.title)).toEqual(['a', 'a', 'b'])
  })

  it('duplicates a done task into the bottom of todo', () => {
    let tasks = seed(['a', 'b'])
    tasks = toggleCompleted(tasks, tasks[0].id)
    tasks = duplicateTask(tasks, tasks[0].id)
    const copy = tasks.find((t) => t.title === 'a' && t.status === 'todo')!
    expect(copy.boardOrder).toBe(1)
  })
})

describe('discarded filter', () => {
  it('shows only discarded tasks, which every other filter hides', () => {
    let tasks = seed(['kept', 'binned'])
    tasks = setStatus(tasks, tasks[1].id, 'discarded')
    const titles = (filter: Parameters<typeof applyFilter>[1]) =>
      applyFilter(tasks, filter).map((t) => t.title)

    expect(titles('discarded')).toEqual(['binned'])
    expect(titles('all')).toEqual(['kept'])
    expect(titles('active')).toEqual(['kept'])
    expect(titles('completed')).toEqual([])
  })
})
