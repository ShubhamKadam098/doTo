import { describe, expect, it } from 'vitest'
import {
  addTask,
  applyFilter,
  deleteTask,
  moveTask,
  normalizeOrders,
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
      completed: false,
      priority: 'none',
      order: 0,
    })
    expect(tasks[1].order).toBe(1)
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
  it('completes and uncompletes without moving the task', () => {
    const tasks = seed(['a'])
    const completed = toggleCompleted(tasks, tasks[0].id)
    expect(completed[0].completed).toBe(true)
    expect(completed[0].date).toBe('2026-09-01')

    const reopened = toggleCompleted(completed, tasks[0].id)
    expect(reopened[0].completed).toBe(false)
  })

  it('keeps completed tasks visible under the default filter', () => {
    const tasks = toggleCompleted(seed(['a', 'b']), seed(['a', 'b'])[0].id)
    expect(applyFilter(tasks, 'all')).toHaveLength(2)
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
    tasks = updateTask(tasks, tasks[0].id, {
      priority: 'high',
      completed: true,
    })
    const target = tasks[0]

    const moved = moveTask(tasks, target.id, '2026-09-03', 0)
    const found = moved.find((task) => task.id === target.id)!

    expect(found.date).toBe('2026-09-03')
    expect(found.order).toBe(0)
    expect(found.title).toBe(target.title)
    expect(found.priority).toBe('high')
    expect(found.completed).toBe(true)
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
