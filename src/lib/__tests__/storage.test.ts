import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_STATE, STORAGE_KEY, load, parseTask, save } from '../storage'
import type { Task } from '../../types/task'

const validTask: Task = {
  id: 't1',
  title: 'ChatBot',
  date: '2026-09-01',
  status: 'todo',
  priority: 'high',
  order: 0,
  boardOrder: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('round-trips state through localStorage', () => {
    save({ version: 2, tasks: [validTask], lastRolloverDate: '2026-09-06' })
    const { state, recovered } = load()

    expect(recovered).toBe(false)
    expect(state.tasks).toEqual([validTask])
    expect(state.lastRolloverDate).toBe('2026-09-06')
  })

  it('returns empty state when nothing is stored', () => {
    expect(load().state).toEqual(EMPTY_STATE)
  })

  it('writes the current schema version', () => {
    save({ version: 2, tasks: [], lastRolloverDate: null })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(2)
  })

  it('recovers from unparseable JSON without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    const { state, recovered } = load()
    expect(state.tasks).toEqual([])
    expect(recovered).toBe(true)
  })

  it('keeps valid tasks when one stored record is malformed', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        tasks: [validTask, { id: 'broken' }, null, { ...validTask, date: 'x' }],
        lastRolloverDate: null,
      }),
    )
    const { state, recovered } = load()

    expect(state.tasks.map((task) => task.id)).toEqual(['t1'])
    expect(recovered).toBe(true)
  })

  it('drops duplicate ids', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, tasks: [validTask, validTask] }),
    )
    expect(load().state.tasks).toHaveLength(1)
  })

  it('migrates an unversioned payload and fills in missing fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks: [{ id: 'a', title: 'x', date: '2026-09-01' }] }),
    )
    const { state, recovered } = load()

    expect(recovered).toBe(true)
    expect(state.version).toBe(2)
    expect(state.tasks[0]).toMatchObject({
      id: 'a',
      status: 'todo',
      boardOrder: 0,
      priority: 'none',
      order: 0,
    })
  })

  it('ignores a malformed lastRolloverDate', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, tasks: [], lastRolloverDate: 'nope' }),
    )
    expect(load().state.lastRolloverDate).toBeNull()
  })

  it('rejects records without a usable id, title or date', () => {
    expect(parseTask({ title: 'x', date: '2026-09-01' })).toBeNull()
    expect(parseTask({ id: 'a', date: '2026-09-01' })).toBeNull()
    expect(parseTask({ id: 'a', title: 'x', date: '2026-02-30' })).toBeNull()
    expect(parseTask('nope')).toBeNull()
  })

  it('coerces an unknown priority back to none', () => {
    expect(parseTask({ ...validTask, priority: 'urgent' })?.priority).toBe(
      'none',
    )
  })

  it('migrates a v1 store: ticked tasks become done, columns follow the week', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        lastRolloverDate: null,
        tasks: [
          { id: 'tue', title: 'Tue', date: '2026-09-02', order: 0, completed: false },
          { id: 'mon-2', title: 'Mon 2', date: '2026-09-01', order: 1, completed: false },
          { id: 'mon-1', title: 'Mon 1', date: '2026-09-01', order: 0, completed: false },
          { id: 'done', title: 'Done', date: '2026-09-01', order: 2, completed: true },
        ],
      }),
    )
    const { state } = load()
    const byId = (id: string) => state.tasks.find((task) => task.id === id)!

    expect(byId('done')).toMatchObject({ status: 'done', boardOrder: 0 })
    expect(byId('mon-1')).toMatchObject({ status: 'todo', boardOrder: 0 })
    expect(byId('mon-2')).toMatchObject({ status: 'todo', boardOrder: 1 })
    expect(byId('tue')).toMatchObject({ status: 'todo', boardOrder: 2 })
  })

  it('reads every status and coerces an unknown one to todo', () => {
    expect(parseTask({ ...validTask, status: 'waiting' })?.status).toBe('waiting')
    expect(parseTask({ ...validTask, status: 'discarded' })?.status).toBe('discarded')
    expect(parseTask({ ...validTask, status: 'archived' })?.status).toBe('todo')
  })

  it('repairs gaps and duplicates in board order on load', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastRolloverDate: null,
        tasks: [
          { ...validTask, id: 'a', boardOrder: 9 },
          { ...validTask, id: 'b', boardOrder: 4 },
          { ...validTask, id: 'c', boardOrder: 4, order: 1 },
        ],
      }),
    )
    const orders = Object.fromEntries(
      load().state.tasks.map((task) => [task.id, task.boardOrder]),
    )
    expect(orders).toEqual({ b: 0, c: 1, a: 2 })
  })
})
