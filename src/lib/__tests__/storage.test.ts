import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_STATE, STORAGE_KEY, load, parseTask, save } from '../storage'
import type { Task } from '../../types/task'

const validTask: Task = {
  id: 't1',
  title: 'ChatBot',
  date: '2026-09-01',
  completed: false,
  priority: 'high',
  order: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('round-trips state through localStorage', () => {
    save({ version: 1, tasks: [validTask], lastRolloverDate: '2026-09-06' })
    const { state, recovered } = load()

    expect(recovered).toBe(false)
    expect(state.tasks).toEqual([validTask])
    expect(state.lastRolloverDate).toBe('2026-09-06')
  })

  it('returns empty state when nothing is stored', () => {
    expect(load().state).toEqual(EMPTY_STATE)
  })

  it('writes the current schema version', () => {
    save({ version: 1, tasks: [], lastRolloverDate: null })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(1)
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
    expect(state.version).toBe(1)
    expect(state.tasks[0]).toMatchObject({
      id: 'a',
      completed: false,
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
})
