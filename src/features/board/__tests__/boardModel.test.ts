import { describe, expect, it } from 'vitest'
import { addTask, setStatus } from '../../../lib/tasks'
import type { Task } from '../../../types/task'
import {
  boardColumn,
  columnIndexFor,
  previewColumns,
  resolveBoardDrop,
} from '../boardModel'

const THIS_WEEK = new Set([
  '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
  '2026-09-11', '2026-09-12', '2026-09-13',
])

function build(entries: Array<[title: string, date: string, status?: Task['status']]>) {
  let tasks: Task[] = []
  for (const [title, date, status] of entries) {
    const result = addTask(tasks, { title, date })!
    tasks = status ? setStatus(result.tasks, result.task.id, status) : result.tasks
  }
  return tasks
}

const titles = (tasks: Task[]) => tasks.map((task) => task.title)
const id = (tasks: Task[], title: string) => tasks.find((t) => t.title === title)!.id

describe('boardColumn', () => {
  it('lists the week’s tasks of one status in board order', () => {
    const tasks = build([
      ['old', '2026-08-31'],
      ['mon', '2026-09-07'],
      ['busy', '2026-09-08', 'in_progress'],
      ['wed', '2026-09-09'],
    ])
    expect(titles(boardColumn(tasks, 'todo', THIS_WEEK))).toEqual(['mon', 'wed'])
    expect(titles(boardColumn(tasks, 'in_progress', THIS_WEEK))).toEqual(['busy'])
  })
})

describe('columnIndexFor', () => {
  it('keeps other weeks’ cards in place', () => {
    // Column order: mon, OLD, wed. OLD belongs to another week.
    let tasks = build([
      ['mon', '2026-09-07'],
      ['OLD', '2026-08-31'],
      ['wed', '2026-09-09'],
    ])
    const toIndex = columnIndexFor(tasks, 'todo', THIS_WEEK, id(tasks, 'wed'), 0)
    tasks = setStatus(tasks, id(tasks, 'wed'), 'todo', toIndex)
    const column = [...tasks].sort((a, b) => a.boardOrder - b.boardOrder)
    expect(titles(column)).toEqual(['wed', 'mon', 'OLD'])
  })

  it('places after the last visible card when dropped past the end', () => {
    const tasks = build([
      ['mon', '2026-09-07'],
      ['FUTURE', '2026-09-21'],
      ['x', '2026-09-08', 'waiting'],
    ])
    expect(
      columnIndexFor(tasks, 'todo', THIS_WEEK, id(tasks, 'x'), Number.POSITIVE_INFINITY),
    ).toBe(1)
  })

  it('appends to an empty visible column', () => {
    const tasks = build([['FUTURE', '2026-09-21'], ['x', '2026-09-08']])
    expect(
      columnIndexFor(tasks, 'done', THIS_WEEK, id(tasks, 'x'), 0),
    ).toBe(0)
  })
})

describe('resolveBoardDrop', () => {
  const tasks = build([
    ['a', '2026-09-07'],
    ['b', '2026-09-08'],
    ['c', '2026-09-09'],
    ['w', '2026-09-09', 'waiting'],
  ])

  it('dragging down past a card lands after it', () => {
    expect(resolveBoardDrop(tasks, THIS_WEEK, id(tasks, 'a'), id(tasks, 'b'))).toEqual({
      status: 'todo',
      toIndex: 1,
    })
  })

  it('dropping on a card in another column lands before it', () => {
    expect(resolveBoardDrop(tasks, THIS_WEEK, id(tasks, 'a'), id(tasks, 'w'))).toEqual({
      status: 'waiting',
      toIndex: 0,
    })
  })

  it('dropping on a column or tab appends to it', () => {
    expect(resolveBoardDrop(tasks, THIS_WEEK, id(tasks, 'a'), 'column:done')).toEqual({
      status: 'done',
      toIndex: 0,
    })
    expect(resolveBoardDrop(tasks, THIS_WEEK, id(tasks, 'a'), 'tab:waiting')).toEqual({
      status: 'waiting',
      toIndex: 1,
    })
  })

  it('ignores drops on itself or nowhere known', () => {
    expect(resolveBoardDrop(tasks, THIS_WEEK, id(tasks, 'a'), id(tasks, 'a'))).toBeNull()
    expect(resolveBoardDrop(tasks, THIS_WEEK, id(tasks, 'a'), 'column:nope')).toBeNull()
    expect(resolveBoardDrop(tasks, THIS_WEEK, 'missing', 'column:done')).toBeNull()
  })
})

describe('previewColumns', () => {
  const tasks = build([
    ['a', '2026-09-07'],
    ['b', '2026-09-08'],
    ['w1', '2026-09-08', 'waiting'],
    ['w2', '2026-09-09', 'waiting'],
  ])
  const columns = (['todo', 'waiting'] as const).map((status) => ({
    status,
    tasks: boardColumn(tasks, status, THIS_WEEK),
  }))
  const shown = (preview: Parameters<typeof previewColumns>[1]) =>
    Object.fromEntries(
      previewColumns(columns, preview).map((c) => [c.status, titles(c.tasks)]),
    )

  it('leaves the columns alone with no drag in flight', () => {
    expect(previewColumns(columns, null)).toBe(columns)
  })

  it('shows the dragged card in the column it would land in, at its place', () => {
    const preview = { id: id(tasks, 'a'), status: 'waiting' as const }
    expect(shown({ ...preview, index: 0 })).toEqual({ todo: ['b'], waiting: ['a', 'w1', 'w2'] })
    expect(shown({ ...preview, index: 1 })).toEqual({ todo: ['b'], waiting: ['w1', 'a', 'w2'] })
    expect(shown({ ...preview, index: 9 })).toEqual({ todo: ['b'], waiting: ['w1', 'w2', 'a'] })
    const moved = previewColumns(columns, { ...preview, index: 0 })[1].tasks[0]
    expect(moved.status).toBe('waiting')
  })
})
