import { describe, expect, it } from 'vitest'
import { tasksForDate } from '../../../lib/tasks'
import {
  initialTaskState,
  taskReducer,
  type TaskAction,
  type TaskState,
} from '../taskReducer'

function run(actions: TaskAction[], from: TaskState = initialTaskState) {
  return actions.reduce(taskReducer, from)
}

function withTasks(titles: string[], date = '2026-09-01') {
  return run(titles.map((title) => ({ type: 'create', date, title })))
}

describe('taskReducer', () => {
  it('creates, renames and deletes', () => {
    let state = withTasks(['ChatBot'])
    const id = state.tasks[0].id

    state = taskReducer(state, { type: 'rename', id, title: 'ChatBot v2' })
    expect(state.tasks[0].title).toBe('ChatBot v2')

    state = taskReducer(state, { type: 'delete', id })
    expect(state.tasks).toEqual([])
  })

  it('ignores empty creations', () => {
    const state = run([{ type: 'create', date: '2026-09-01', title: '   ' }])
    expect(state.tasks).toEqual([])
    expect(state.past).toEqual([])
  })

  it('deletes a task when its title is cleared', () => {
    let state = withTasks(['ChatBot'])
    state = taskReducer(state, {
      type: 'rename',
      id: state.tasks[0].id,
      title: '  ',
    })
    expect(state.tasks).toEqual([])
  })

  it('treats a no-op rename as a non-mutation', () => {
    const state = withTasks(['ChatBot'])
    const next = taskReducer(state, {
      type: 'rename',
      id: state.tasks[0].id,
      title: 'ChatBot',
    })
    expect(next).toBe(state)
  })

  it('toggles completion and priority', () => {
    let state = withTasks(['a'])
    const id = state.tasks[0].id

    state = taskReducer(state, { type: 'toggle', id })
    expect(state.tasks[0].completed).toBe(true)

    state = taskReducer(state, { type: 'setPriority', id, priority: 'medium' })
    expect(state.tasks[0].priority).toBe('medium')
  })
})

describe('undo / redo', () => {
  it('undoes and redoes a creation', () => {
    let state = withTasks(['a'])
    state = taskReducer(state, { type: 'undo' })
    expect(state.tasks).toEqual([])

    state = taskReducer(state, { type: 'redo' })
    expect(state.tasks.map((t) => t.title)).toEqual(['a'])
  })

  it('undoes a deletion, restoring the same task id', () => {
    const created = withTasks(['a'])
    const id = created.tasks[0].id
    const deleted = taskReducer(created, { type: 'delete', id })
    const restored = taskReducer(deleted, { type: 'undo' })

    expect(restored.tasks[0].id).toBe(id)
  })

  it('undoes a completion toggle', () => {
    let state = withTasks(['a'])
    state = taskReducer(state, { type: 'toggle', id: state.tasks[0].id })
    state = taskReducer(state, { type: 'undo' })
    expect(state.tasks[0].completed).toBe(false)
  })

  it('undoes a date/order move', () => {
    let state = withTasks(['a', 'b'])
    const id = state.tasks[0].id

    state = taskReducer(state, { type: 'move', id, toDate: '2026-09-03', toIndex: 0 })
    expect(state.tasks.find((t) => t.id === id)!.date).toBe('2026-09-03')

    state = taskReducer(state, { type: 'undo' })
    expect(state.tasks.find((t) => t.id === id)!.date).toBe('2026-09-01')
    expect(tasksForDate(state.tasks, '2026-09-01').map((t) => t.title)).toEqual([
      'a',
      'b',
    ])
  })

  it('undoes a rollover as one step', () => {
    let state = withTasks(['a', 'b'], '2026-09-01')
    state = taskReducer(state, { type: 'rollover', today: '2026-09-06' })
    expect(state.tasks.every((t) => t.date === '2026-09-06')).toBe(true)

    state = taskReducer(state, { type: 'undo' })
    expect(state.tasks.every((t) => t.date === '2026-09-01')).toBe(true)
  })

  it('records a rename as a single history entry', () => {
    let state = withTasks(['a'])
    const depth = state.past.length
    state = taskReducer(state, {
      type: 'rename',
      id: state.tasks[0].id,
      title: 'abcdef',
    })
    expect(state.past.length).toBe(depth + 1)
  })

  it('clears the redo stack on a new mutation', () => {
    let state = withTasks(['a'])
    state = taskReducer(state, { type: 'undo' })
    expect(state.future).toHaveLength(1)

    state = taskReducer(state, { type: 'create', date: '2026-09-02', title: 'b' })
    expect(state.future).toEqual([])
  })

  it('is a no-op at the ends of the history', () => {
    expect(taskReducer(initialTaskState, { type: 'undo' })).toBe(
      initialTaskState,
    )
    expect(taskReducer(initialTaskState, { type: 'redo' })).toBe(
      initialTaskState,
    )
  })

  it('does not push history for a rollover that moves nothing', () => {
    const state = withTasks(['a'], '2026-09-06')
    const next = taskReducer(state, { type: 'rollover', today: '2026-09-06' })
    expect(next.past.length).toBe(state.past.length)
    expect(next.lastRolloverDate).toBe('2026-09-06')
  })

  it('hydrate resets the history', () => {
    const state = withTasks(['a'])
    const hydrated = taskReducer(state, {
      type: 'hydrate',
      tasks: [],
      lastRolloverDate: null,
    })
    expect(hydrated.past).toEqual([])
    expect(hydrated.future).toEqual([])
  })
})
