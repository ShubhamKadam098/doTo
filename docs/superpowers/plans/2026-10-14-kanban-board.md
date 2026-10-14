# Kanban Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Board view (Todo · In Progress · Waiting · Done) next to the weekly planner, backed by a task `status` with its own per-column order, plus discard/restore.

**Architecture:** `Task.completed` is replaced by `Task.status` and a new `Task.boardOrder`. All rules live in `src/lib/` (pure, unit-tested) and reach React only through new reducer actions, so undo/redo covers them for free. The board is a new `src/features/board/` feature that reads the visible week from `PlannerContext`; pure board maths (column contents, index translation, drop resolution) lives in `boardModel.ts`.

**Tech Stack:** React 19, TypeScript 6, Tailwind 4, dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`), Base UI menus via shadcn wrappers, Vitest + Testing Library (jsdom), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-kanban-board-design.md`

## Global Constraints

- Statuses, exactly: `'todo' | 'in_progress' | 'waiting' | 'done' | 'discarded'`. Board columns, in order: Todo · In Progress · Waiting · Done.
- User-facing labels: `Todo`, `In progress`, `Waiting`, `Done`, `Discarded`.
- `STORAGE_VERSION` becomes `2`; storage key stays `doto.state`. View preference key: `doto.view`, values `'week' | 'board'`.
- `boardOrder` is contiguous `0..n-1` within each status after every operation. Board operations never change `date` or `order`.
- Every status change, board reorder, discard and restore is exactly one undo step; no-ops add none.
- `src/lib/` and `src/features/tasks/` stay free of React/DOM imports.
- Match existing style: no semicolons, single quotes, 2-space indent, comments only where they explain *why*.
- Commit messages follow the repo's `feat:` / `fix:` / `refactor:` / `docs:` / `test:` style. No AI attribution lines in commits.
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`. Baseline before Task 1: 9 files, 112 tests passing.

## Review Focus

1. Reordering this week's board when other weeks have cards in the same status must keep those other cards' relative order → test in Task 2 (`boardModel.test.ts`, "keeps other weeks' cards in place").
2. Dropping or Alt-moving a card to where it already is must not add an undo step → test in Task 2 (reducer, "a no-op status change adds no history").
3. A version-1 store with ticked tasks must open with them Done and each column in week order → test in Task 1 (storage, "migrates a v1 store").
4. Clicking a blank row while the Discarded filter is on must not open an editor (a created task would instantly vanish) → test in Task 3 ("blank rows are inert under the Discarded filter").
5. A missing, unknown or unreadable `doto.view` must fall back to Week → test in Task 4 (`viewPreference.test.ts`).

---

## File Map

| File | Responsibility | Task |
| --- | --- | --- |
| `src/types/task.ts` | `Status`, `BOARD_STATUSES`, `OPEN_STATUSES`, `Task` shape, `Filter` | 1, 2 |
| `src/lib/tasks.ts` | `isOpen`, `byBoardOrder`, `normalizeBoardOrders`, `setStatus`, `reorderOnBoard`, updated CRUD/toggle/duplicate/filter | 1, 2 |
| `src/lib/rollover.ts` | roll only open statuses | 1 |
| `src/lib/storage.ts` | v2 schema, status/boardOrder parsing, migration | 1 |
| `src/lib/status.ts` | labels and pill rule | 2 |
| `src/features/tasks/taskReducer.ts` | `setStatus`, `reorderOnBoard`, `create.status` actions | 2 |
| `src/features/board/boardModel.ts` | `boardColumn`, `columnIndexFor`, `resolveBoardDrop` | 2 |
| `src/features/planner/*` | status pill, status menu items, detail sheet status, Discarded filter, provider methods, view switch | 1, 3, 4 |
| `src/components/StatusMenuItems.tsx` | shared "Move to … / Discard / Restore" context-menu items | 3 |
| `src/features/search/SearchDialog.tsx` | Discarded tag | 1, 3 |
| `src/lib/viewPreference.ts` | read/write `doto.view` | 4 |
| `src/hooks/useGlobalShortcuts.ts` | `V` shortcut | 4 |
| `src/features/board/Board.tsx`, `BoardColumn.tsx`, `BoardCard.tsx`, `AddCard.tsx` | desktop board | 4, 5 |
| `src/features/board/BoardDnd.tsx` | drag between/within columns | 5 |
| `src/features/board/MobileBoard.tsx` | one column + tabs | 6 |
| `src/test/appFixtures.tsx` | shared integration-test helpers for new test files | 3 |
| `README.md` | keyboard + behaviour docs | 7 |

---

### Task 1: Status model and storage v2

Replaces `completed` with `status` + `boardOrder` everywhere, adds `setStatus`, and migrates stored data. User-visible behaviour is unchanged.

**Files:**
- Modify: `src/types/task.ts`, `src/lib/tasks.ts`, `src/lib/rollover.ts`, `src/lib/storage.ts`
- Modify (mechanical): `src/features/planner/TaskRow.tsx`, `src/features/planner/TaskDetailSheet.tsx`, `src/features/planner/PlannerProvider.tsx`, `src/features/search/SearchDialog.tsx`
- Test: `src/lib/__tests__/tasks.test.ts`, `src/lib/__tests__/rollover.test.ts`, `src/lib/__tests__/storage.test.ts`, `src/features/tasks/__tests__/taskReducer.test.ts`, `src/features/planner/__tests__/planner.test.tsx`

**Interfaces:**
- Produces (types): `Status`, `STATUSES`, `BOARD_STATUSES`, `BoardStatus`, `OPEN_STATUSES`, `isBoardStatus(status): status is BoardStatus`; `Task.status: Status`, `Task.boardOrder: number`.
- Produces (lib/tasks.ts): `isOpen(task: Task): boolean`, `byBoardOrder(a: Task, b: Task): number`, `normalizeBoardOrders(tasks: Task[], statuses?: Status[]): Task[]`, `setStatus(tasks: Task[], id: string, status: Status, toIndex?: number): Task[]`, `addTask(tasks, { title, date, priority?, status? })`, `createTask({ title, date, priority?, status?, order, boardOrder })`.

- [ ] **Step 1: Update the Task type**

Replace `src/types/task.ts` with:

```ts
export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const

export type Priority = (typeof PRIORITIES)[number]

export const STATUSES = [
  'todo',
  'in_progress',
  'waiting',
  'done',
  'discarded',
] as const

export type Status = (typeof STATUSES)[number]

/** Board columns, left to right. Discarded is an action, not a column. */
export const BOARD_STATUSES = [
  'todo',
  'in_progress',
  'waiting',
  'done',
] as const satisfies readonly Status[]

export type BoardStatus = (typeof BOARD_STATUSES)[number]

/** Still to be done: these roll over and count as active. */
export const OPEN_STATUSES: readonly Status[] = ['todo', 'in_progress', 'waiting']

export function isBoardStatus(status: Status): status is BoardStatus {
  return (BOARD_STATUSES as readonly Status[]).includes(status)
}

/** `date` is a local calendar day key: `yyyy-MM-dd`. Never a timestamp. */
export interface Task {
  id: string
  title: string
  date: string
  status: Status
  priority: Priority
  /** Position within its day. */
  order: number
  /** Position within its status column on the board. */
  boardOrder: number
  createdAt: string
  updatedAt: string
}

export type Filter = 'all' | 'active' | 'completed'

export const FILTERS: readonly Filter[] = ['all', 'active', 'completed']
```

- [ ] **Step 2: Write failing domain tests**

In `src/lib/__tests__/tasks.test.ts`:

1. Extend the import list with `normalizeBoardOrders` and `setStatus`.
2. In "creates a task with defaults and appended order", replace `completed: false,` with `status: 'todo',` and add `boardOrder: 0,` after `order: 0,`. After `expect(tasks[1].order).toBe(1)` add `expect(tasks[1].boardOrder).toBe(1)`.
3. Replace the whole `describe('completion', …)` block with:

```ts
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
```

4. In "moves a task between days, preserving identity and fields", replace

```ts
    tasks = updateTask(tasks, tasks[0].id, {
      priority: 'high',
      completed: true,
    })
```

with

```ts
    tasks = updateTask(tasks, tasks[0].id, { priority: 'high' })
    tasks = toggleCompleted(tasks, tasks[0].id)
```

and `expect(found.completed).toBe(true)` with `expect(found.status).toBe('done')`.

In `src/lib/__tests__/rollover.test.ts`:

1. Change the import to `import { addTask, setStatus, tasksForDate, updateTask } from '../tasks'`.
2. Replace the `build` helper with:

```ts
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
```

3. Replace every `completed: true` inside `build([...])` calls with `status: 'done'`.
4. Replace `expect(after.completed).toBe(false)` with `expect(after.status).toBe('todo')`.
5. Add at the end of `describe('rollover', …)`:

```ts
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
```

In `src/features/tasks/__tests__/taskReducer.test.ts`, replace `expect(state.tasks[0].completed).toBe(true)` with `expect(state.tasks[0].status).toBe('done')`, `expect(state.tasks[0].completed).toBe(false)` with `expect(state.tasks[0].status).toBe('todo')`, and `expect(copy.completed).toBe(false)` with `expect(copy.status).toBe('todo')`.

- [ ] **Step 3: Write failing storage tests**

In `src/lib/__tests__/storage.test.ts`:

1. In `validTask`, replace `completed: false,` with `status: 'todo',` and add `boardOrder: 0,` after `order: 0,`.
2. Change both `save({ version: 1, …` calls to `version: 2`, and `toBe(1)` in "writes the current schema version" to `toBe(2)`.
3. In "migrates an unversioned payload…", replace `expect(state.version).toBe(1)` with `toBe(2)` and the `toMatchObject` body's `completed: false,` with `status: 'todo',` plus `boardOrder: 0,`.
4. Add inside `describe('storage', …)`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm test src/lib src/features/tasks`
Expected: FAIL — `setStatus`/`normalizeBoardOrders` are not exported, `status` is undefined on created tasks.

- [ ] **Step 5: Implement the domain changes in `src/lib/tasks.ts`**

1. Change the type import to `import { OPEN_STATUSES, type Filter, type Priority, type Status, type Task } from '../types/task'`.
2. After `byOrder`, add:

```ts
export function isOpen(task: Task): boolean {
  return OPEN_STATUSES.includes(task.status)
}

/** Board position, falling back to the week's own order so ties read naturally. */
export function byBoardOrder(a: Task, b: Task): number {
  if (a.boardOrder !== b.boardOrder) return a.boardOrder - b.boardOrder
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return byOrder(a, b)
}
```

3. Replace `applyFilter` with:

```ts
export function applyFilter(tasks: Task[], filter: Filter): Task[] {
  if (filter === 'active') return tasks.filter(isOpen)
  if (filter === 'completed') {
    return tasks.filter((task) => task.status === 'done')
  }
  return tasks.filter((task) => task.status !== 'discarded')
}
```

4. After `normalizeOrders`, add:

```ts
/** Rewrites `boardOrder` to dense 0..n-1 within each affected status column. */
export function normalizeBoardOrders(
  tasks: Task[],
  statuses?: Status[],
): Task[] {
  const targets = statuses ? new Set(statuses) : null
  const grouped = new Map<Status, Task[]>()

  for (const task of tasks) {
    if (targets && !targets.has(task.status)) continue
    const list = grouped.get(task.status)
    if (list) list.push(task)
    else grouped.set(task.status, [task])
  }

  const resolved = new Map<string, number>()
  for (const list of grouped.values()) {
    list.sort(byBoardOrder)
    list.forEach((task, index) => resolved.set(task.id, index))
  }

  return tasks.map((task) => {
    const boardOrder = resolved.get(task.id)
    return boardOrder === undefined || boardOrder === task.boardOrder
      ? task
      : { ...task, boardOrder }
  })
}
```

5. Replace `createTask` and `addTask` with:

```ts
export function createTask(input: {
  title: string
  date: string
  priority?: Priority
  status?: Status
  order: number
  boardOrder: number
}): Task {
  const timestamp = nowIso()
  return {
    id: createId(),
    title: input.title,
    date: input.date,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'none',
    order: input.order,
    boardOrder: input.boardOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Appends a new task to the end of its day and its column. Empty titles are rejected. */
export function addTask(
  tasks: Task[],
  input: { title: string; date: string; priority?: Priority; status?: Status },
): { tasks: Task[]; task: Task } | null {
  const title = input.title.trim()
  if (title.length === 0) return null
  const status = input.status ?? 'todo'
  const task = createTask({
    ...input,
    title,
    status,
    order: tasksForDate(tasks, input.date).length,
    boardOrder: tasks.filter((task) => task.status === status).length,
  })
  return { tasks: [...tasks, task], task }
}
```

6. Change `updateTask`'s patch type to `Partial<Pick<Task, 'title' | 'priority'>>`.
7. Replace `deleteTask` and `toggleCompleted` with:

```ts
export function deleteTask(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks
  return normalizeBoardOrders(
    normalizeOrders(
      tasks.filter((task) => task.id !== id),
      [target.date],
    ),
    [target.status],
  )
}

/**
 * Moves a task into `status` at `toIndex` within that column (the bottom when
 * omitted), closing the gap it leaves. Covers reordering within a column too.
 * Never changes the task's day or its place in that day.
 */
export function setStatus(
  tasks: Task[],
  id: string,
  status: Status,
  toIndex?: number,
): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks
  if (target.status === status && toIndex === undefined) return tasks

  const column = tasks
    .filter((task) => task.status === status && task.id !== id)
    .sort(byBoardOrder)
  const index = Math.max(0, Math.min(toIndex ?? column.length, column.length))

  if (target.status === status) {
    const current = tasks
      .filter((task) => task.status === status)
      .sort(byBoardOrder)
      .findIndex((task) => task.id === id)
    if (current === index) return tasks
  }

  column.splice(index, 0, target)
  const orderById = new Map<string, number>()
  column.forEach((task, position) => orderById.set(task.id, position))

  const timestamp = nowIso()
  const moved = tasks.map((task) => {
    const boardOrder = orderById.get(task.id)
    if (task.id === id) {
      return { ...task, status, boardOrder: boardOrder ?? index, updatedAt: timestamp }
    }
    return boardOrder === undefined || boardOrder === task.boardOrder
      ? task
      : { ...task, boardOrder }
  })

  return target.status === status
    ? moved
    : normalizeBoardOrders(moved, [target.status])
}

/** The week's checkbox: Done reopens to Todo, anything open becomes Done. */
export function toggleCompleted(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target || target.status === 'discarded') return tasks
  return setStatus(tasks, id, target.status === 'done' ? 'todo' : 'done')
}
```

8. Replace `duplicateTask` with:

```ts
/**
 * Copies a task in beneath the original. An open task's copy keeps its status
 * and sits under it on the board; a done or discarded one starts over in Todo.
 */
export function duplicateTask(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return tasks

  const status = isOpen(target) ? target.status : 'todo'
  const sameColumn = status === target.status

  const copy = createTask({
    title: target.title,
    date: target.date,
    priority: target.priority,
    status,
    order: target.order + 1,
    boardOrder: sameColumn
      ? target.boardOrder + 1
      : tasks.filter((task) => task.status === status).length,
  })

  const shifted = tasks.map((task) => {
    let next = task
    if (task.date === target.date && task.order > target.order) {
      next = { ...next, order: next.order + 1 }
    }
    if (
      sameColumn &&
      task.status === status &&
      task.boardOrder > target.boardOrder
    ) {
      next = { ...next, boardOrder: next.boardOrder + 1 }
    }
    return next
  })

  return normalizeBoardOrders(
    normalizeOrders(shifted.concat(copy), [target.date]),
    [status],
  )
}
```

- [ ] **Step 6: Roll only open statuses**

In `src/lib/rollover.ts`, change the import to `import { byOrder, isOpen, nowIso } from './tasks'`, the filter to `.filter((task) => isOpen(task) && task.date < today)`, and the doc comment's first sentence to: "Moves every open (todo, in progress, waiting) task dated before `today` onto `today`…". Replace "Completed tasks" with "Done and discarded tasks" and "completion state" with "status, board position".

- [ ] **Step 7: Storage v2**

In `src/lib/storage.ts`:

1. Imports become:

```ts
import { isDateKey } from './date'
import { normalizeBoardOrders } from './tasks'
import {
  PRIORITIES,
  STATUSES,
  type Priority,
  type Status,
  type Task,
} from '../types/task'
```

2. `export const STORAGE_VERSION = 2`
3. After `asPriority`, add:

```ts
/** Version 1 stored a `completed` flag; it maps onto done or todo. */
function asStatus(value: unknown, legacyCompleted: unknown): Status {
  if (STATUSES.includes(value as Status)) return value as Status
  return legacyCompleted === true ? 'done' : 'todo'
}
```

4. In `parseTask`, replace `completed: value.completed === true,` with `status: asStatus(value.status, value.completed),`, and after the `order` property add:

```ts
    // Unknown positions sort last; `load` ranks each column as a whole.
    boardOrder:
      typeof value.boardOrder === 'number' && Number.isFinite(value.boardOrder)
        ? value.boardOrder
        : Number.POSITIVE_INFINITY,
```

5. In `load`, change the final return to:

```ts
  return {
    state: {
      version: STORAGE_VERSION,
      tasks: normalizeBoardOrders(tasks),
      lastRolloverDate,
    },
    recovered,
  }
```

- [ ] **Step 8: Run domain tests**

Run: `pnpm test src/lib src/features/tasks`
Expected: PASS.

- [ ] **Step 9: Update UI reads of `completed`**

- `src/features/planner/TaskRow.tsx`: `const completed = task?.status === 'done'`.
- `src/features/planner/TaskDetailSheet.tsx`: after `const planner = usePlanner()` add `const completed = task.status === 'done'` and replace every `task.completed` with `completed`.
- `src/features/search/SearchDialog.tsx`: inside the `results.map` callback, before `return`, add `const completed = task.status === 'done'` (turn the arrow body into a block) and replace every `task.completed` with `completed`.
- `src/features/planner/PlannerProvider.tsx`: import `isOpen` alongside `applyFilter, tasksForDate`, and in `revealTask` replace the filter condition with:

```ts
        (current === 'active' && !isOpen(task)) ||
        (current === 'completed' && task.status !== 'done')
```

In `src/features/planner/__tests__/planner.test.tsx`: in every `Task` object literal replace `completed: false` with `status: 'todo'` and `completed: true` with `status: 'done'`; in `makeTask` defaults also add `boardOrder: 0,` after `order: 0,`; replace `storedTasks()[0].completed).toBe(true)` with `storedTasks()[0].status).toBe('done')` and `.completed).toBe(false)` with `.status).toBe('todo')`. Leave `rowName`'s `completed` option alone — it names the aria label, not the field.

- [ ] **Step 10: Verify everything**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: no type or lint errors; all tests pass (112 + the new ones).

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "refactor: give tasks a status and a board order"
```

---

### Task 2: Board domain — reorder, reducer actions, Discarded filter, board model

**Files:**
- Modify: `src/types/task.ts`, `src/lib/tasks.ts`, `src/features/tasks/taskReducer.ts`, `src/features/planner/PlannerHeader.tsx` (one label)
- Create: `src/lib/status.ts`, `src/features/board/boardModel.ts`
- Test: `src/lib/__tests__/tasks.test.ts`, `src/features/tasks/__tests__/taskReducer.test.ts`, `src/features/board/__tests__/boardModel.test.ts`

**Interfaces:**
- Consumes: `setStatus`, `byBoardOrder`, `BOARD_STATUSES`, `isBoardStatus` (Task 1).
- Produces: `reorderOnBoard(tasks: Task[], id: string, toIndex: number): Task[]`; `Filter` gains `'discarded'`; reducer actions `{ type: 'setStatus'; id; status: Status; toIndex?: number }`, `{ type: 'reorderOnBoard'; id; toIndex: number }`, `create` gains `status?: Status`; `STATUS_LABEL: Record<Status, string>`, `showsStatusPill(status: Status): boolean`; `boardColumn(tasks, status, dates: ReadonlySet<string>): Task[]`, `columnIndexFor(tasks, status, dates, id, visibleIndex: number): number`, `resolveBoardDrop(tasks, dates, activeId, overId): { status: BoardStatus; toIndex: number } | null`, `COLUMN_PREFIX = 'column:'`, `TAB_PREFIX = 'tab:'`.

- [ ] **Step 1: Write failing tests**

Append to `src/lib/__tests__/tasks.test.ts` (add `reorderOnBoard` and `duplicateTask` to the import):

```ts
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
```

Append to `src/features/tasks/__tests__/taskReducer.test.ts`:

```ts
describe('status actions', () => {
  it('creates a task straight into a status', () => {
    const state = run([
      { type: 'create', date: '2026-09-01', title: 'a', status: 'waiting' },
    ])
    expect(state.tasks[0].status).toBe('waiting')
  })

  it('moves status and reorders as single undoable steps', () => {
    let state = withTasks(['a', 'b'])
    const [a, b] = state.tasks

    state = taskReducer(state, { type: 'setStatus', id: a.id, status: 'in_progress' })
    expect(state.tasks[0].status).toBe('in_progress')
    state = taskReducer(state, { type: 'undo' })
    expect(state.tasks[0].status).toBe('todo')

    state = taskReducer(state, { type: 'reorderOnBoard', id: b.id, toIndex: 0 })
    expect(state.tasks.find((t) => t.id === b.id)!.boardOrder).toBe(0)
    state = taskReducer(state, { type: 'undo' })
    expect(state.tasks.find((t) => t.id === b.id)!.boardOrder).toBe(1)
  })

  it('a no-op status change adds no history', () => {
    const state = withTasks(['a', 'b'])
    const id = state.tasks[0].id
    expect(taskReducer(state, { type: 'setStatus', id, status: 'todo' })).toBe(state)
    expect(taskReducer(state, { type: 'setStatus', id, status: 'todo', toIndex: 0 })).toBe(state)
    expect(taskReducer(state, { type: 'reorderOnBoard', id, toIndex: 0 })).toBe(state)
  })
})
```

Create `src/features/board/__tests__/boardModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addTask, setStatus } from '../../../lib/tasks'
import type { Task } from '../../../types/task'
import {
  boardColumn,
  columnIndexFor,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib src/features/tasks src/features/board`
Expected: FAIL — `reorderOnBoard`, the reducer actions and `boardModel` do not exist.

- [ ] **Step 3: Implement**

`src/types/task.ts` — replace the last two lines with:

```ts
export type Filter = 'all' | 'active' | 'completed' | 'discarded'

export const FILTERS: readonly Filter[] = ['all', 'active', 'completed', 'discarded']
```

`src/lib/tasks.ts` — in `applyFilter`, before the final return add:

```ts
  if (filter === 'discarded') {
    return tasks.filter((task) => task.status === 'discarded')
  }
```

and after `setStatus` add:

```ts
/** Moves a task within its own column. */
export function reorderOnBoard(
  tasks: Task[],
  id: string,
  toIndex: number,
): Task[] {
  const target = tasks.find((task) => task.id === id)
  return target ? setStatus(tasks, id, target.status, toIndex) : tasks
}
```

`src/features/planner/PlannerHeader.tsx` — add `discarded: 'Discarded',` to `FILTER_LABEL`.

Create `src/lib/status.ts`:

```ts
import type { Status } from '../types/task'

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
  discarded: 'Discarded',
}

/**
 * Week rows only call out the in-between states: Todo is the default and Done
 * already has its strikethrough.
 */
export function showsStatusPill(status: Status): boolean {
  return status === 'in_progress' || status === 'waiting'
}
```

`src/features/tasks/taskReducer.ts`:

1. Import `reorderOnBoard` and `setStatus` from `../../lib/tasks`, and `Status` from the types.
2. Change the `create` action to `{ type: 'create'; date: string; title: string; priority?: Priority; status?: Status }` and add to the union:

```ts
  | { type: 'setStatus'; id: string; status: Status; toIndex?: number }
  | { type: 'reorderOnBoard'; id: string; toIndex: number }
```

3. In `case 'create'`, pass `status: action.status` into `addTask`.
4. After `case 'move'`, add:

```ts
    case 'setStatus':
      return commit(state, {
        tasks: setStatus(state.tasks, action.id, action.status, action.toIndex),
      })

    case 'reorderOnBoard':
      return commit(state, {
        tasks: reorderOnBoard(state.tasks, action.id, action.toIndex),
      })
```

(`commit` already returns `state` unchanged when the task array is identical, so no-ops add no history.)

Create `src/features/board/boardModel.ts`:

```ts
import { byBoardOrder } from '../../lib/tasks'
import {
  BOARD_STATUSES,
  isBoardStatus,
  type BoardStatus,
  type Status,
  type Task,
} from '../../types/task'

export const COLUMN_PREFIX = 'column:'
export const TAB_PREFIX = 'tab:'

/** The visible week's tasks in one status, in board order. */
export function boardColumn(
  tasks: Task[],
  status: Status,
  dates: ReadonlySet<string>,
): Task[] {
  return tasks
    .filter((task) => task.status === status && dates.has(task.date))
    .sort(byBoardOrder)
}

/**
 * Translates a position among the cards the board shows into a position in the
 * whole column, which also holds other weeks' tasks. `visibleIndex` follows
 * array-move semantics against the visible column as it stands (including `id`
 * when it is already there), so dragging down past a card lands after it. Past
 * the end means "after the last visible card".
 */
export function columnIndexFor(
  tasks: Task[],
  status: Status,
  dates: ReadonlySet<string>,
  id: string,
  visibleIndex: number,
): number {
  const full = tasks
    .filter((task) => task.status === status && task.id !== id)
    .sort(byBoardOrder)
  const visible = full.filter((task) => dates.has(task.date))

  if (visibleIndex >= visible.length) {
    const last = visible.at(-1)
    return last ? full.indexOf(last) + 1 : full.length
  }
  return full.indexOf(visible[Math.max(0, visibleIndex)])
}

function statusFromDropId(overId: string): BoardStatus | null {
  const prefix = [COLUMN_PREFIX, TAB_PREFIX].find((p) => overId.startsWith(p))
  if (!prefix) return null
  const name = overId.slice(prefix.length)
  return (BOARD_STATUSES as readonly string[]).includes(name)
    ? (name as BoardStatus)
    : null
}

/**
 * Works out where a dragged card lands: on another card (its column, at its
 * place), or on a column or mobile tab (the bottom of that column). Returns
 * null when the drop names nothing usable.
 */
export function resolveBoardDrop(
  tasks: Task[],
  dates: ReadonlySet<string>,
  activeId: string,
  overId: string,
): { status: BoardStatus; toIndex: number } | null {
  if (!tasks.some((task) => task.id === activeId)) return null

  const named = statusFromDropId(overId)
  if (named) {
    return {
      status: named,
      toIndex: columnIndexFor(tasks, named, dates, activeId, Number.POSITIVE_INFINITY),
    }
  }

  const target = tasks.find((task) => task.id === overId)
  if (!target || target.id === activeId || !isBoardStatus(target.status)) {
    return null
  }
  const visibleIndex = boardColumn(tasks, target.status, dates).findIndex(
    (task) => task.id === target.id,
  )
  return {
    status: target.status,
    toIndex: columnIndexFor(tasks, target.status, dates, activeId, visibleIndex),
  }
}
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: board ordering, status actions and a discarded filter"
```

---

### Task 3: Status in the week view

Status pill, "Move to …" / Discard / Restore in the row menu, status picker in the detail sheet, read-only Discarded filter with Restore, Discarded tag in search.

**Files:**
- Create: `src/components/StatusMenuItems.tsx`, `src/test/appFixtures.tsx`, `src/features/planner/__tests__/status.test.tsx`
- Modify: `src/features/planner/PlannerContext.ts`, `src/features/planner/PlannerProvider.tsx`, `src/features/planner/TaskRow.tsx`, `src/features/planner/TaskDetailSheet.tsx`, `src/features/search/SearchDialog.tsx`

**Interfaces:**
- Consumes: reducer actions and `STATUS_LABEL`, `showsStatusPill` (Task 2).
- Produces on `PlannerValue`: `setStatus(id: string, status: Status, toIndex?: number): void`, `reorderOnBoard(id: string, toIndex: number): void`, `discardTask(id: string): void`, `restoreTask(id: string): void`; `createTask(date: string, title: string, status?: Status): void` (status optional, existing callers unchanged). `StatusMenuItems` props `{ task: Task; onMove: (status: BoardStatus) => void; onDiscard: () => void; onRestore: () => void }` (renders `ContextMenuItem`s). Test helpers in `src/test/appFixtures.tsx`: `stubMatchMedia`, `makeTask`, `seedStorage`, `storedTasks`, `renderApp`, `dayName`, `TODAY`, `WEEK_START`.

- [ ] **Step 1: Shared test fixtures**

Create `src/test/appFixtures.tsx` (same behaviour as the helpers at the top of `planner.test.tsx`, which stays as it is):

```ts
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import App from '../App'
import {
  formatDayNumber,
  formatWeekdayLong,
  startOfWeekKey,
  todayKey,
} from '../lib/date'
import { STORAGE_KEY, type PersistedState } from '../lib/storage'
import type { Task } from '../types/task'

export const TODAY = todayKey()
export const WEEK_START = startOfWeekKey(TODAY)

/** jsdom has no matchMedia; the app picks desktop vs mobile from it. */
export function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
}

let seq = 0

export function makeTask(
  input: Partial<Task> & { title: string; date: string },
): Task {
  seq += 1
  const stamp = new Date(Date.UTC(2020, 0, 1, 0, 0, seq)).toISOString()
  return {
    id: `seed-${seq}`,
    status: 'todo',
    priority: 'none',
    order: 0,
    boardOrder: 0,
    createdAt: stamp,
    updatedAt: stamp,
    ...input,
  }
}

export function seedStorage(tasks: Task[]): void {
  const state: PersistedState = { version: 2, tasks, lastRolloverDate: null }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function storedTasks(): Task[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === null ? [] : (JSON.parse(raw) as PersistedState).tasks
}

export function renderApp({ desktop = true } = {}) {
  stubMatchMedia(desktop)
  return render(<App />)
}

export function dayName(date: string): string {
  return `${formatWeekdayLong(date)} ${formatDayNumber(date)}`
}
```

Every later import uses `../../../test/appFixtures`.

- [ ] **Step 2: Write failing integration tests**

Create `src/features/planner/__tests__/status.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TODAY,
  dayName,
  makeTask,
  renderApp,
  seedStorage,
  storedTasks,
} from '../../../test/appFixtures'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

const row = (title: string, status = '') =>
  screen.getByRole('button', {
    name: `${title}. ${dayName(TODAY)}. Not completed.${status ? ` ${status}.` : ''} Priority None`,
  })

async function openMenu(user: ReturnType<typeof userEvent.setup>, target: HTMLElement) {
  await user.pointer({ target, keys: '[MouseRight]' })
  return within(screen.getByRole('menu'))
}

describe('status in the week', () => {
  it('shows a pill for in-progress and waiting tasks only', () => {
    seedStorage([
      makeTask({ title: 'Doing', date: TODAY, status: 'in_progress' }),
      makeTask({ title: 'Blocked', date: TODAY, status: 'waiting', order: 1 }),
      makeTask({ title: 'Plain', date: TODAY, order: 2 }),
    ])
    renderApp()

    expect(within(row('Doing', 'In progress')).getByText('In progress')).toBeInTheDocument()
    expect(within(row('Blocked', 'Waiting')).getByText('Waiting')).toBeInTheDocument()
    expect(within(row('Plain')).queryByText('Todo')).not.toBeInTheDocument()
  })

  it('moves a task to another status from the right-click menu', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    const menu = await openMenu(user, row('Groceries'))
    expect(menu.queryByRole('menuitem', { name: 'Move to Todo' })).not.toBeInTheDocument()
    await user.click(menu.getByRole('menuitem', { name: 'Move to Waiting' }))

    expect(storedTasks()[0].status).toBe('waiting')
    expect(row('Groceries', 'Waiting')).toBeInTheDocument()
  })

  it('discards from the menu, then restores from the Discarded filter', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    const menu = await openMenu(user, row('Groceries'))
    await user.click(menu.getByRole('menuitem', { name: 'Discard' }))
    expect(storedTasks()[0].status).toBe('discarded')
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()

    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Filter tasks' })).getByRole('radio', {
        name: 'Discarded',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Restore "Groceries"' }))

    expect(storedTasks()[0].status).toBe('todo')
  })

  it('blank rows are inert under the Discarded filter', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Filter tasks' })).getByRole('radio', {
        name: 'Discarded',
      }),
    )
    await user.click(screen.getAllByRole('button', { name: `Empty row on ${dayName(TODAY)}` })[0])

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('sets status from the mobile detail sheet', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp({ desktop: false })

    await user.click(row('Groceries'))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'In progress' }))
    expect(storedTasks()[0].status).toBe('in_progress')

    await user.click(within(dialog).getByRole('button', { name: 'Discard task' }))
    expect(storedTasks()[0].status).toBe('discarded')
  })

  it('finds discarded tasks in search, tagged, and reveals them', async () => {
    seedStorage([makeTask({ title: 'Old idea', date: TODAY, status: 'discarded' })])
    const user = userEvent.setup()
    renderApp()

    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('Old')
    const option = screen.getByRole('option', { name: /Old idea/ })
    expect(within(option).getByText('Discarded')).toBeInTheDocument()

    await user.click(option)
    expect(
      within(screen.getByRole('radiogroup', { name: 'Filter tasks' })).getByRole('radio', {
        name: 'Discarded',
      }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test src/features/planner/__tests__/status.test.tsx`
Expected: FAIL — no pill, no menu items, no Discarded tag.

- [ ] **Step 4: Provider and context**

`src/features/planner/PlannerContext.ts`: import `Status` from the types; change `createTask` to `(date: string, title: string, status?: Status) => void` and add after `relocateTask`:

```ts
  setStatus: (id: string, status: Status, toIndex?: number) => void
  reorderOnBoard: (id: string, toIndex: number) => void
  /** Hides a task without deleting it; Restore brings it back to Todo. */
  discardTask: (id: string) => void
  restoreTask: (id: string) => void
```

`src/features/planner/PlannerProvider.tsx`:

1. Import `Status` from the types.
2. `createTask` becomes:

```ts
  const createTask = useCallback(
    (date: string, title: string, status?: Status) =>
      dispatch({ type: 'create', date, title, status }),
    [dispatch],
  )
```

3. Replace `removeTask` with a shared helper plus the three callers:

```ts
  /** Runs a change that takes `id` out of its day's visible rows. */
  const takeOutOfView = useCallback(
    (id: string, run: () => void) => {
      // Focus is a position, so losing a row above it would otherwise leave an
      // open editor pointing at whatever slid into its place.
      const removedRow = tasksForDate(state.tasks, focus?.date ?? '').findIndex(
        (task) => task.id === id,
      )

      // Animated so the rows below close the gap rather than jumping into it.
      withViewTransition(() => {
        run()
        if (removedRow >= 0) {
          setFocus((current) =>
            current && current.row > removedRow
              ? { ...current, row: current.row - 1 }
              : current,
          )
        }
      })
    },
    [focus?.date, state.tasks],
  )
  const removeTask = useCallback(
    (id: string) => takeOutOfView(id, () => dispatch({ type: 'delete', id })),
    [dispatch, takeOutOfView],
  )
  const discardTask = useCallback(
    (id: string) =>
      takeOutOfView(id, () =>
        dispatch({ type: 'setStatus', id, status: 'discarded' }),
      ),
    [dispatch, takeOutOfView],
  )
  const restoreTask = useCallback(
    (id: string) =>
      takeOutOfView(id, () => dispatch({ type: 'setStatus', id, status: 'todo' })),
    [dispatch, takeOutOfView],
  )
  const setStatus = useCallback(
    (id: string, status: Status, toIndex?: number) =>
      dispatch({ type: 'setStatus', id, status, toIndex }),
    [dispatch],
  )
  const reorderOnBoard = useCallback(
    (id: string, toIndex: number) =>
      dispatch({ type: 'reorderOnBoard', id, toIndex }),
    [dispatch],
  )
```

4. `revealTask`'s `setFilter` callback becomes:

```ts
      setFilter((current) => {
        if (task.status === 'discarded') return 'discarded'
        return current === 'discarded' ||
          (current === 'active' && !isOpen(task)) ||
          (current === 'completed' && task.status !== 'done')
          ? 'all'
          : current
      })
```

5. Add `setStatus, reorderOnBoard, discardTask, restoreTask` to both the `value` object and its dependency array.

- [ ] **Step 5: Shared menu items**

Create `src/components/StatusMenuItems.tsx`:

```tsx
import { STATUS_LABEL } from '../lib/status'
import { BOARD_STATUSES, type BoardStatus, type Task } from '../types/task'
import { ContextMenuItem } from './ui/context-menu'

interface StatusMenuItemsProps {
  task: Task
  onMove: (status: BoardStatus) => void
  onDiscard: () => void
  onRestore: () => void
}

/** "Move to …" for every other column, then Discard (or Restore). Shared by week rows and board cards. */
export function StatusMenuItems({
  task,
  onMove,
  onDiscard,
  onRestore,
}: StatusMenuItemsProps) {
  if (task.status === 'discarded') {
    return <ContextMenuItem onClick={onRestore}>Restore</ContextMenuItem>
  }
  return (
    <>
      {BOARD_STATUSES.filter((status) => status !== task.status).map(
        (status) => (
          <ContextMenuItem key={status} onClick={() => onMove(status)}>
            Move to {STATUS_LABEL[status]}
          </ContextMenuItem>
        ),
      )}
      <ContextMenuItem onClick={onDiscard}>Discard</ContextMenuItem>
    </>
  )
}
```

- [ ] **Step 6: TaskRow**

In `src/features/planner/TaskRow.tsx`:

1. Imports: add `import { StatusMenuItems } from '../../components/StatusMenuItems'` and `import { STATUS_LABEL, showsStatusPill } from '../../lib/status'`.
2. After `const isEditing = …` add:

```ts
  // Discarded tasks are a list to restore from, not a place to write.
  const readOnly = planner.filter === 'discarded'
```

3. `startEditing` becomes:

```ts
  const startEditing = () => {
    if (!readOnly) planner.focusSlot({ date, row: editRow }, true)
  }
```

4. In `onRowKeyDown`, the `' '` case returns early when `readOnly` too: `if (!task || readOnly) return`.
5. Replace the title button's `aria-label` expression with:

```tsx
          aria-label={
            task
              ? `${task.title}. ${formatWeekdayLong(date)} ${formatDayNumber(date)}. ${
                  completed ? 'Completed' : 'Not completed'
                }.${
                  showsStatusPill(task.status)
                    ? ` ${STATUS_LABEL[task.status]}.`
                    : ''
                } Priority ${PRIORITY_LABEL[task.priority]}`
              : readOnly
                ? `Empty row on ${formatWeekdayLong(date)} ${formatDayNumber(date)}`
                : `Add a task on ${formatWeekdayLong(date)} ${formatDayNumber(date)}`
          }
```

and its `className` swaps `cursor-text` for `${readOnly ? 'cursor-default' : 'cursor-text'}`.

6. After the title `<span>` inside the button, add the pill:

```tsx
          {task && showsStatusPill(task.status) && (
            <span className="ml-2.5 shrink-0 rounded-full border border-line-strong px-1.5 py-px text-[0.6875rem] text-muted">
              {STATUS_LABEL[task.status]}
            </span>
          )}
```

7. Replace the controls cluster `{task && ( <div className="flex shrink-0 items-center gap-0.5"> … </div> )}` contents so a discarded task shows only Restore:

```tsx
      {task && task.status === 'discarded' && !isEditing && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => planner.restoreTask(task.id)}
          aria-label={`Restore "${task.title}"`}
          className="shrink-0 rounded-full px-2 py-0.5 text-[0.8125rem] text-muted transition hover:text-text"
        >
          Restore
        </button>
      )}

      {task && task.status !== 'discarded' && (
        <div className="flex shrink-0 items-center gap-0.5">
          {/* …the existing PriorityMenu, trash and check buttons, unchanged… */}
        </div>
      )}
```

(Move the three existing children into the second block verbatim.)

8. In the context menu, replace the two items with:

```tsx
      <ContextMenuContent>
        <StatusMenuItems
          task={task}
          onMove={(status) => planner.setStatus(task.id, status)}
          onDiscard={() => planner.discardTask(task.id)}
          onRestore={() => planner.restoreTask(task.id)}
        />
        <ContextMenuItem onClick={() => planner.duplicateTask(task.id)}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={() => planner.removeTask(task.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
```

- [ ] **Step 7: TaskDetailSheet**

In `src/features/planner/TaskDetailSheet.tsx`:

1. Imports: add `import { STATUS_LABEL } from '../../lib/status'`; change the types import to `import { BOARD_STATUSES, PRIORITIES, type Task } from '../../types/task'`.
2. Update the doc comment to "Focused task editor: rename, set status or priority, discard or delete one task."
3. After the priority `</fieldset>`, add:

```tsx
        <fieldset className="mt-5">
          <legend className="text-sm text-muted">Status</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {BOARD_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={task.status === status}
                onClick={() => planner.setStatus(task.id, status)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  task.status === status
                    ? 'border-line-strong text-text'
                    : 'border-line text-muted'
                }`}
              >
                {STATUS_LABEL[status]}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => {
            if (task.status === 'discarded') planner.restoreTask(task.id)
            else {
              planner.discardTask(task.id)
              onClose()
            }
          }}
          className="mt-6 text-sm text-muted transition-colors hover:text-text"
        >
          {task.status === 'discarded' ? 'Restore task' : 'Discard task'}
        </button>
```

- [ ] **Step 8: Search tag**

In `src/features/search/SearchDialog.tsx`, after the date `<span>`, add:

```tsx
                {task.status === 'discarded' && (
                  <span className="shrink-0 rounded-full border border-line px-1.5 text-[0.6875rem] text-muted">
                    Discarded
                  </span>
                )}
```

and give the title span `task.status === 'discarded' ? 'text-muted' : …` ahead of the existing completed/plain classes:

```tsx
                  className={`min-w-0 flex-1 truncate text-[0.9375rem] ${
                    task.status === 'discarded'
                      ? 'text-muted'
                      : completed
                        ? 'text-done line-through'
                        : 'text-text'
                  }`}
```

- [ ] **Step 9: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass, including the existing planner suite (Duplicate still exists in the menu; existing row names are unchanged for todo/done tasks).

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: status, discard and restore in the week view"
```

---

### Task 4: View switch and the board layout

**Files:**
- Create: `src/lib/viewPreference.ts`, `src/lib/__tests__/viewPreference.test.ts`, `src/features/board/Board.tsx`, `src/features/board/BoardColumn.tsx`, `src/features/board/BoardCard.tsx`, `src/features/board/AddCard.tsx`, `src/features/board/__tests__/board.test.tsx`
- Modify: `src/features/planner/PlannerContext.ts`, `src/features/planner/PlannerProvider.tsx`, `src/features/planner/PlannerHeader.tsx`, `src/features/planner/Planner.tsx`, `src/hooks/useGlobalShortcuts.ts`

**Interfaces:**
- Consumes: `boardColumn` (Task 2), `planner.createTask(date, title, status)` (Task 3), `priorityPill`, `formatWeekdayShort`, `formatDayNumber`, `weekDayKeys`.
- Produces: `type View = 'week' | 'board'`, `VIEW_KEY = 'doto.view'`, `loadView(storage?): View`, `saveView(view, storage?): void`; on `PlannerValue`: `view: View`, `setView(view: View): void`; `ShortcutHandlers.onToggleView`; `<Board isDesktop: boolean />`; `BoardCard` props `{ task: Task; today: string; isFocused: boolean; isTabbable: boolean; onFocus: () => void; onKeyDown: (event: KeyboardEvent<HTMLElement>) => void; onOpen: () => void }`; card accessible name `"<title>. <Weekday> <day>. Priority <level>"`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/viewPreference.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { VIEW_KEY, loadView, saveView } from '../viewPreference'

beforeEach(() => localStorage.clear())

describe('view preference', () => {
  it('defaults to week and round-trips board', () => {
    expect(loadView()).toBe('week')
    saveView('board')
    expect(localStorage.getItem(VIEW_KEY)).toBe('board')
    expect(loadView()).toBe('board')
  })

  it('falls back to week for unknown values or broken storage', () => {
    localStorage.setItem(VIEW_KEY, 'kanban')
    expect(loadView()).toBe('week')

    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(loadView(throwing)).toBe('week')
    expect(() => saveView('board', throwing)).not.toThrow()
  })
})
```

Create `src/features/board/__tests__/board.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addWeeksToKey } from '../../../lib/date'
import { VIEW_KEY } from '../../../lib/viewPreference'
import {
  TODAY,
  WEEK_START,
  dayName,
  makeTask,
  renderApp,
  seedStorage,
  storedTasks,
} from '../../../test/appFixtures'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

const cardName = (title: string, date = TODAY, priority = 'None') =>
  `${title}. ${dayName(date)}. Priority ${priority}`

const column = (label: string) => screen.getByRole('region', { name: label })

async function openBoard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(screen.getByRole('radiogroup', { name: 'View' })).getByRole('radio', {
      name: 'Board',
    }),
  )
}

describe('board view', () => {
  it('switches with the header toggle and with V, and remembers the choice', async () => {
    const user = userEvent.setup()
    const { unmount } = renderApp()

    await openBoard(user)
    expect(column('Todo')).toBeInTheDocument()
    expect(localStorage.getItem(VIEW_KEY)).toBe('board')
    expect(screen.queryByRole('radiogroup', { name: 'Filter tasks' })).not.toBeInTheDocument()

    unmount()
    renderApp()
    expect(column('Todo')).toBeInTheDocument()

    await user.keyboard('v')
    expect(screen.queryByRole('region', { name: 'Todo' })).not.toBeInTheDocument()
    expect(localStorage.getItem(VIEW_KEY)).toBe('week')
  })

  it('shows this week’s tasks in their columns with counts', async () => {
    seedStorage([
      makeTask({ title: 'Plan', date: TODAY }),
      makeTask({ title: 'Build', date: TODAY, status: 'in_progress', order: 1 }),
      makeTask({ title: 'Await', date: TODAY, status: 'waiting', order: 2 }),
      makeTask({ title: 'Ship', date: TODAY, status: 'done', order: 3 }),
      makeTask({ title: 'Binned', date: TODAY, status: 'discarded', order: 4 }),
      makeTask({ title: 'Later', date: addWeeksToKey(WEEK_START, 1) }),
    ])
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    expect(within(column('Todo')).getByRole('button', { name: cardName('Plan') })).toBeInTheDocument()
    expect(within(column('In progress')).getByRole('button', { name: cardName('Build') })).toBeInTheDocument()
    expect(within(column('Waiting')).getByRole('button', { name: cardName('Await') })).toBeInTheDocument()
    expect(within(column('Done')).getByRole('button', { name: cardName('Ship') })).toBeInTheDocument()
    expect(within(column('Todo')).getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('Binned')).not.toBeInTheDocument()
    expect(screen.queryByText('Later')).not.toBeInTheDocument()
  })

  it('adds a task straight into a column, dated today', async () => {
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    await user.click(within(column('Waiting')).getByRole('button', { name: 'Add a task to Waiting' }))
    await user.keyboard('Call the bank{Enter}')

    expect(storedTasks()[0]).toMatchObject({ title: 'Call the bank', status: 'waiting', date: TODAY })
    expect(within(column('Waiting')).getByRole('button', { name: cardName('Call the bank') })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/lib/__tests__/viewPreference.test.ts src/features/board`
Expected: FAIL — modules and the View toggle do not exist.

- [ ] **Step 3: View preference**

Create `src/lib/viewPreference.ts`:

```ts
import { safeStorage } from './storage'

export type View = 'week' | 'board'

/** A UI preference, kept out of task state so it never enters undo history. */
export const VIEW_KEY = 'doto.view'

export function loadView(storage: Storage | undefined = safeStorage()): View {
  try {
    return storage?.getItem(VIEW_KEY) === 'board' ? 'board' : 'week'
  } catch {
    return 'week'
  }
}

export function saveView(
  view: View,
  storage: Storage | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(VIEW_KEY, view)
  } catch {
    // Same as task storage: a blocked write must not break the app.
  }
}
```

- [ ] **Step 4: Context, provider, shortcuts**

`PlannerContext.ts`: `import type { View } from '../../lib/viewPreference'`; add to `PlannerValue` after `filter: Filter`: `view: View`, and after `setFilter`: `setView: (view: View) => void`.

`PlannerProvider.tsx`:

```ts
import { loadView, saveView, type View } from '../../lib/viewPreference'
…
  const [view, setViewState] = useState<View>(loadView)
…
  const setView = useCallback((next: View) => {
    setViewState(next)
    saveView(next)
    setFocus(null)
    setEditing(false)
  }, [])
```

In `revealTask`, add `setViewState('week')` and `saveView('week')` as its first two lines (focus is a week row, so a revealed task always opens in the week). Add `view` and `setView` to the value object and its dependency array.

`src/hooks/useGlobalShortcuts.ts`: add `onToggleView: () => void` to `ShortcutHandlers`, and after the `n`/`N` branch:

```ts
      } else if (event.key === 'v' || event.key === 'V') {
        event.preventDefault()
        handlers.onToggleView()
      }
```

- [ ] **Step 5: Header toggle**

In `PlannerHeader.tsx`, wrap the filter `radiogroup` in `{planner.view === 'week' && ( … )}` and, as the first child of the right-hand `<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">`, add:

```tsx
        <div
          role="radiogroup"
          aria-label="View"
          className="flex items-center rounded-full bg-elevated p-0.5"
        >
          {(['week', 'board'] as const).map((view) => (
            <button
              key={view}
              type="button"
              role="radio"
              aria-checked={planner.view === view}
              onClick={() => planner.setView(view)}
              title={`${view === 'week' ? 'Week' : 'Board'} view (V)`}
              className={`rounded-full px-2.5 py-1 text-[0.8125rem] transition-colors sm:px-3 sm:text-sm ${
                planner.view === view
                  ? 'bg-line text-text'
                  : 'text-muted hover:text-text'
              }`}
            >
              {view === 'week' ? 'Week' : 'Board'}
            </button>
          ))}
        </div>
```

- [ ] **Step 6: Planner switches views**

In `Planner.tsx`:

1. `import { Board } from '../board/Board'`.
2. In the shortcuts `useMemo`, change `onNewTask: focusNewTask` to `onNewTask: planner.view === 'week' ? focusNewTask : () => {}`, add `onToggleView: () => planner.setView(planner.view === 'week' ? 'board' : 'week')`, and add `planner.view, planner.setView` to its dependency array.
3. Replace the `<main>` contents with:

```tsx
      <main id="planner">
        {planner.view === 'board' ? (
          <>
            <h2 className="sr-only">
              Board. Arrow keys move between cards, Alt with an arrow moves the
              card, Enter opens it.
            </h2>
            <Board isDesktop={isDesktop} />
          </>
        ) : (
          <>
            <h2 className="sr-only">
              Weekly planner. Arrow keys move between rows and days, Enter edits,
              Space completes, Delete removes.
            </h2>
            <PlannerDnd>{isDesktop ? <WeekGrid /> : <MobileWeek />}</PlannerDnd>
          </>
        )}
      </main>
```

- [ ] **Step 7: Board components (layout only; interaction lands in Task 5)**

Create `src/features/board/BoardCard.tsx`:

```tsx
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { formatDayNumber, formatWeekdayLong, formatWeekdayShort } from '../../lib/date'
import { PRIORITY_LABEL, priorityPill } from '../../lib/priority'
import type { Task } from '../../types/task'

export interface BoardCardProps {
  task: Task
  today: string
  isFocused: boolean
  /** One card owns the tab stop, as one row does in the week. */
  isTabbable: boolean
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
}

export function BoardCard({
  task,
  today,
  isFocused,
  isTabbable,
  onFocus,
  onKeyDown,
  onOpen,
}: BoardCardProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const done = task.status === 'done'
  const isToday = task.date === today

  // Follows the card across columns: a move remounts it in its new column.
  useEffect(() => {
    if (isFocused) ref.current?.focus()
  }, [isFocused])

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={isTabbable ? 0 : -1}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={onOpen}
      aria-label={`${task.title}. ${formatWeekdayLong(task.date)} ${formatDayNumber(
        task.date,
      )}. Priority ${PRIORITY_LABEL[task.priority]}`}
      className={`flex w-full flex-col items-start gap-1.5 rounded-lg border bg-elevated px-3 py-2.5 text-left transition-colors focus-visible:outline-none ${
        isFocused ? 'border-accent/60' : 'border-line hover:border-line-strong'
      }`}
    >
      <span className={`max-w-full truncate text-[0.9375rem] ${priorityPill(task.priority, done)}`}>
        {task.title}
      </span>
      <span className={`text-xs ${isToday ? 'text-accent' : 'text-muted'}`}>
        {formatWeekdayShort(task.date)} {formatDayNumber(task.date)}
      </span>
    </button>
  )
}
```

Create `src/features/board/AddCard.tsx`:

```tsx
import { useState } from 'react'

/** "+ Add task" that opens into an input; Enter keeps it open for the next one. */
export function AddCard({
  label,
  onAdd,
}: {
  label: string
  onAdd: (title: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Add a task to ${label}`}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:text-text"
      >
        + Add task
      </button>
    )
  }

  const submit = () => {
    if (value.trim()) onAdd(value)
    setValue('')
  }

  return (
    <input
      autoFocus
      value={value}
      aria-label={`New ${label} task`}
      placeholder="Task"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        submit()
        setOpen(false)
      }}
      onKeyDown={(event) => {
        // Typing must never reach the board's or the page's shortcuts.
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          submit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setValue('')
          setOpen(false)
        }
      }}
      className="w-full rounded-lg border border-accent/45 bg-elevated px-3 py-2 text-[0.9375rem] text-text outline-none placeholder:text-muted"
    />
  )
}
```

Create `src/features/board/BoardColumn.tsx`:

```tsx
import type { ReactNode } from 'react'
import { STATUS_LABEL } from '../../lib/status'
import type { BoardStatus } from '../../types/task'
import { AddCard } from './AddCard'

export function BoardColumn({
  status,
  count,
  onAdd,
  children,
}: {
  status: BoardStatus
  count: number
  onAdd: (title: string) => void
  children: ReactNode
}) {
  const label = STATUS_LABEL[status]
  return (
    <section aria-label={label} className="flex min-w-0 flex-col">
      <header className="flex items-baseline justify-between border-b border-line-strong pb-2">
        <h2 className="text-[1.0625rem] font-bold tracking-tight">{label}</h2>
        <span className="text-sm text-muted">{count}</span>
      </header>
      <ul className="flex flex-col gap-2 pt-3">
        {children}
        {count === 0 && (
          <li className="px-3 py-2 text-sm text-muted">Nothing here</li>
        )}
      </ul>
      <div className="pt-2">
        <AddCard label={label} onAdd={onAdd} />
      </div>
    </section>
  )
}
```

Create `src/features/board/Board.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { weekDayKeys } from '../../lib/date'
import { BOARD_STATUSES } from '../../types/task'
import { usePlanner } from '../planner/PlannerContext'
import { BoardCard } from './BoardCard'
import { BoardColumn } from './BoardColumn'
import { boardColumn } from './boardModel'

/** The visible week's tasks as four status columns. */
export function Board({ isDesktop }: { isDesktop: boolean }) {
  const planner = usePlanner()
  const [focusId, setFocusId] = useState<string | null>(null)

  const dates = useMemo(
    () => new Set(weekDayKeys(planner.weekStart)),
    [planner.weekStart],
  )
  const columns = useMemo(
    () =>
      BOARD_STATUSES.map((status) => ({
        status,
        tasks: boardColumn(planner.allTasks, status, dates),
      })),
    [planner.allTasks, dates],
  )

  // New cards land on today when it is in view, else on the week's Monday.
  const addDate = dates.has(planner.today) ? planner.today : planner.weekStart
  const firstId = columns.find((column) => column.tasks.length > 0)?.tasks[0].id

  return (
    <div
      className={
        isDesktop
          ? 'grid grid-cols-4 gap-6 px-10 pb-24'
          : 'flex flex-col gap-8 px-4 pb-24'
      }
    >
      {columns.map(({ status, tasks }) => (
        <BoardColumn
          key={status}
          status={status}
          count={tasks.length}
          onAdd={(title) => planner.createTask(addDate, title, status)}
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <BoardCard
                task={task}
                today={planner.today}
                isFocused={focusId === task.id}
                isTabbable={(focusId ?? firstId) === task.id}
                onFocus={() => setFocusId(task.id)}
                onKeyDown={() => {}}
                onOpen={() => {}}
              />
            </li>
          ))}
        </BoardColumn>
      ))}
    </div>
  )
}
```

(The mobile branch is a stacked placeholder; Task 6 replaces it.)

- [ ] **Step 8: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: switch between the week and a status board"
```

---

### Task 5: Board interaction — keyboard, drag, menu, detail sheet

**Files:**
- Create: `src/features/board/BoardDnd.tsx`
- Modify: `src/features/board/Board.tsx`, `src/features/board/BoardCard.tsx`, `src/features/board/BoardColumn.tsx`
- Test: `src/features/board/__tests__/board.test.tsx`

**Interfaces:**
- Consumes: `columnIndexFor`, `resolveBoardDrop`, `COLUMN_PREFIX` (Task 2); `planner.setStatus`, `reorderOnBoard`, `discardTask`, `toggleTask`, `setPriority`, `removeTask`, `duplicateTask` (Task 3); `StatusMenuItems` (Task 3); `TaskDetailSheet`; `PriorityMenu`; `PRIORITY_BY_KEY`.
- Produces: `<BoardDnd dates={Set<string>}>`; `BoardCard` becomes a sortable `<li>` wrapper and takes `task`, plus the props above.

- [ ] **Step 1: Write failing tests**

Append to `src/features/board/__tests__/board.test.tsx`:

```tsx
describe('board interaction', () => {
  const orderOf = (status: string) =>
    storedTasks()
      .filter((task) => task.status === status)
      .sort((a, b) => a.boardOrder - b.boardOrder)
      .map((task) => task.title)

  it('Alt+→ moves a card to the next column and keeps focus on it', async () => {
    seedStorage([makeTask({ title: 'Plan', date: TODAY })])
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    const card = within(column('Todo')).getByRole('button', { name: cardName('Plan') })
    card.focus()
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')

    expect(storedTasks()[0].status).toBe('in_progress')
    const moved = within(column('In progress')).getByRole('button', { name: cardName('Plan') })
    expect(moved).toHaveFocus()
  })

  it('Alt+↓ reorders within the column; undo puts it back', async () => {
    seedStorage([
      makeTask({ title: 'First', date: TODAY, boardOrder: 0 }),
      makeTask({ title: 'Second', date: TODAY, order: 1, boardOrder: 1 }),
    ])
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    within(column('Todo')).getByRole('button', { name: cardName('First') }).focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(orderOf('todo')).toEqual(['Second', 'First'])

    await user.keyboard('{Control>}z{/Control}')
    expect(orderOf('todo')).toEqual(['First', 'Second'])
  })

  it('arrow keys move focus across columns', async () => {
    seedStorage([
      makeTask({ title: 'Plan', date: TODAY }),
      makeTask({ title: 'Ship', date: TODAY, status: 'done', order: 1 }),
    ])
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    within(column('Todo')).getByRole('button', { name: cardName('Plan') }).focus()
    await user.keyboard('{ArrowRight}')
    expect(within(column('Done')).getByRole('button', { name: cardName('Ship') })).toHaveFocus()
  })

  it('Space completes, number keys set priority, Enter opens the sheet', async () => {
    seedStorage([makeTask({ title: 'Plan', date: TODAY })])
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    within(column('Todo')).getByRole('button', { name: cardName('Plan') }).focus()
    await user.keyboard('4')
    expect(storedTasks()[0].priority).toBe('high')
    await user.keyboard(' ')
    expect(storedTasks()[0].status).toBe('done')

    within(column('Done')).getByRole('button', { name: cardName('Plan', TODAY, 'High') }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Task: Plan' })).toBeInTheDocument()
  })

  it('discards from the card menu', async () => {
    seedStorage([makeTask({ title: 'Plan', date: TODAY })])
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    await user.pointer({
      target: within(column('Todo')).getByRole('button', { name: cardName('Plan') }),
      keys: '[MouseRight]',
    })
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Discard' }))

    expect(storedTasks()[0].status).toBe('discarded')
    expect(screen.queryByText('Plan')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/features/board/__tests__/board.test.tsx`
Expected: FAIL — keyboard handlers are no-ops, no menu, no sheet.

- [ ] **Step 3: Sortable card with menu**

Replace `src/features/board/BoardCard.tsx` with:

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { PriorityMenu } from '../../components/PriorityMenu'
import { StatusMenuItems } from '../../components/StatusMenuItems'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../components/ui/context-menu'
import { formatDayNumber, formatWeekdayLong, formatWeekdayShort } from '../../lib/date'
import { PRIORITY_LABEL, priorityPill } from '../../lib/priority'
import { usePlanner } from '../planner/PlannerContext'
import type { Task } from '../../types/task'

export interface BoardCardProps {
  task: Task
  today: string
  isFocused: boolean
  /** One card owns the tab stop, as one row does in the week. */
  isTabbable: boolean
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
  /** Touch has no hover, so mobile drops the priority dot and the menu. */
  variant?: 'desktop' | 'mobile'
}

export function BoardCard({
  task,
  today,
  isFocused,
  isTabbable,
  onFocus,
  onKeyDown,
  onOpen,
  variant = 'desktop',
}: BoardCardProps) {
  const planner = usePlanner()
  const ref = useRef<HTMLButtonElement>(null)
  const done = task.status === 'done'
  const isToday = task.date === today
  const isMobile = variant === 'mobile'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { status: task.status } })

  // Follows the card across columns: a move remounts it in its new column.
  useEffect(() => {
    if (isFocused) ref.current?.focus()
  }, [isFocused])

  const itemProps = {
    ref: setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition },
    ...listeners,
    className: `group relative flex items-start gap-2 rounded-lg border bg-elevated px-3 py-2.5 transition-colors ${
      isFocused ? 'border-accent/60' : 'border-line hover:border-line-strong'
    } ${isDragging ? 'z-20 opacity-40' : ''}`,
  }

  const content = (
    <>
      <button
        ref={ref}
        type="button"
        {...attributes}
        tabIndex={isTabbable ? 0 : -1}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onClick={onOpen}
        aria-label={`${task.title}. ${formatWeekdayLong(task.date)} ${formatDayNumber(
          task.date,
        )}. Priority ${PRIORITY_LABEL[task.priority]}`}
        className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left focus-visible:outline-none"
      >
        <span className={`max-w-full truncate text-[0.9375rem] ${priorityPill(task.priority, done)}`}>
          {task.title}
        </span>
        <span className={`text-xs ${isToday ? 'text-accent' : 'text-muted'}`}>
          {formatWeekdayShort(task.date)} {formatDayNumber(task.date)}
        </span>
      </button>
      {!isMobile && (
        <PriorityMenu
          value={task.priority}
          onChange={(priority) => planner.setPriority(task.id, priority)}
          tabIndex={-1}
          dim
        />
      )}
    </>
  )

  if (isMobile) return <li {...itemProps}>{content}</li>

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<li {...itemProps} />}>{content}</ContextMenuTrigger>
      <ContextMenuContent>
        <StatusMenuItems
          task={task}
          onMove={(status) => planner.setStatus(task.id, status)}
          onDiscard={() => planner.discardTask(task.id)}
          onRestore={() => planner.restoreTask(task.id)}
        />
        <ContextMenuItem onClick={() => planner.duplicateTask(task.id)}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={() => planner.removeTask(task.id)}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

- [ ] **Step 4: Droppable, sortable column**

In `src/features/board/BoardColumn.tsx`:

1. Imports: `import { useDroppable } from '@dnd-kit/core'`, `import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'`, `import { COLUMN_PREFIX } from './boardModel'`.
2. Add a prop `ids: string[]` (the column's card ids in order).
3. In the body, before `return`: `const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` })`.
4. Put `ref={setNodeRef}` on the `<section>` and add `${isOver ? 'rounded-lg bg-elevated/40' : ''}` to its className.
5. Wrap the `<ul>` in `<SortableContext items={ids} strategy={verticalListSortingStrategy}> … </SortableContext>`.

- [ ] **Step 5: Drag context**

Create `src/features/board/BoardDnd.tsx`:

```tsx
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useState, type ReactNode } from 'react'
import { usePlanner } from '../planner/PlannerContext'
import { resolveBoardDrop } from './boardModel'
import type { Task } from '../../types/task'

// Same reasoning as the week: ask what the pointer is inside before comparing
// centres, so a tall neighbouring column never wins over the one under it.
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  if (underPointer.length > 0) return underPointer
  const intersecting = rectIntersection(args)
  return intersecting.length > 0 ? intersecting : closestCenter(args)
}

export function BoardDnd({
  dates,
  children,
}: {
  dates: ReadonlySet<string>
  children: ReactNode
}) {
  const planner = usePlanner()
  const [active, setActive] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  useEffect(() => {
    if (!active) return
    document.body.dataset.dragging = 'true'
    return () => {
      delete document.body.dataset.dragging
    }
  }, [active])

  const onDragStart = (event: DragStartEvent) => {
    setActive(planner.allTasks.find((task) => task.id === event.active.id) ?? null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null)
    if (!event.over) return
    const id = String(event.active.id)
    const drop = resolveBoardDrop(planner.allTasks, dates, id, String(event.over.id))
    // setStatus covers reordering within a column and is a no-op in place.
    if (drop) planner.setStatus(id, drop.status, drop.toIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="cursor-grabbing truncate rounded-lg border border-line-strong bg-elevated px-3 py-2.5 text-[0.9375rem] text-text">
            {active.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 6: Keyboard, sheet and dnd in Board**

Replace `src/features/board/Board.tsx` with:

```tsx
import { useMemo, useState, type KeyboardEvent } from 'react'
import { weekDayKeys } from '../../lib/date'
import { PRIORITY_BY_KEY } from '../../lib/priority'
import { BOARD_STATUSES, type Task } from '../../types/task'
import { usePlanner } from '../planner/PlannerContext'
import { TaskDetailSheet } from '../planner/TaskDetailSheet'
import { BoardCard } from './BoardCard'
import { BoardColumn } from './BoardColumn'
import { BoardDnd } from './BoardDnd'
import { boardColumn, columnIndexFor } from './boardModel'

/** The visible week's tasks as four status columns. */
export function Board({ isDesktop }: { isDesktop: boolean }) {
  const planner = usePlanner()
  const [focusId, setFocusId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = planner.allTasks.find((task) => task.id === detailId) ?? null

  const dates = useMemo(
    () => new Set(weekDayKeys(planner.weekStart)),
    [planner.weekStart],
  )
  const columns = useMemo(
    () =>
      BOARD_STATUSES.map((status) => ({
        status,
        tasks: boardColumn(planner.allTasks, status, dates),
      })),
    [planner.allTasks, dates],
  )

  // New cards land on today when it is in view, else on the week's Monday.
  const addDate = dates.has(planner.today) ? planner.today : planner.weekStart
  const firstId = columns.find((column) => column.tasks.length > 0)?.tasks[0].id

  const locate = (id: string) => {
    for (let c = 0; c < columns.length; c++) {
      const r = columns[c].tasks.findIndex((task) => task.id === id)
      if (r >= 0) return { c, r }
    }
    return null
  }

  const moveFocus = (id: string, dc: number, dr: number) => {
    const at = locate(id)
    if (!at) return
    if (dc === 0) {
      const list = columns[at.c].tasks
      setFocusId(list[Math.max(0, Math.min(list.length - 1, at.r + dr))].id)
      return
    }
    // Skip empty columns so focus never lands on nothing.
    let c = at.c + dc
    while (c >= 0 && c < columns.length && columns[c].tasks.length === 0) c += dc
    if (c < 0 || c >= columns.length) return
    const list = columns[c].tasks
    setFocusId(list[Math.min(at.r, list.length - 1)].id)
  }

  const moveCard = (task: Task, dc: number, dr: number) => {
    const at = locate(task.id)
    if (!at) return
    if (dc !== 0) {
      const next = BOARD_STATUSES[at.c + dc]
      if (!next) return
      planner.setStatus(
        task.id,
        next,
        columnIndexFor(planner.allTasks, next, dates, task.id, Number.POSITIVE_INFINITY),
      )
      return
    }
    const to = at.r + dr
    if (to < 0 || to >= columns[at.c].tasks.length) return
    planner.reorderOnBoard(
      task.id,
      columnIndexFor(planner.allTasks, task.status, dates, task.id, to),
    )
  }

  const onCardKeyDown = (task: Task) => (event: KeyboardEvent<HTMLElement>) => {
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }
    const arrow = arrows[event.key]
    if (arrow) {
      event.preventDefault()
      if (event.altKey) moveCard(task, ...arrow)
      else moveFocus(task.id, ...arrow)
      return
    }
    if (event.altKey || event.metaKey || event.ctrlKey) return

    if (event.key === 'Enter') {
      event.preventDefault()
      setDetailId(task.id)
    } else if (event.key === ' ') {
      event.preventDefault()
      planner.toggleTask(task.id)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      moveFocus(task.id, 0, 1)
      planner.removeTask(task.id)
    } else if (PRIORITY_BY_KEY[event.key]) {
      event.preventDefault()
      planner.setPriority(task.id, PRIORITY_BY_KEY[event.key])
    }
  }

  return (
    <BoardDnd dates={dates}>
      <div
        className={
          isDesktop
            ? 'grid grid-cols-4 gap-6 px-10 pb-24'
            : 'flex flex-col gap-8 px-4 pb-24'
        }
      >
        {columns.map(({ status, tasks }) => (
          <BoardColumn
            key={status}
            status={status}
            count={tasks.length}
            ids={tasks.map((task) => task.id)}
            onAdd={(title) => planner.createTask(addDate, title, status)}
          >
            {tasks.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                today={planner.today}
                isFocused={focusId === task.id}
                isTabbable={(focusId ?? firstId) === task.id}
                onFocus={() => setFocusId(task.id)}
                onKeyDown={onCardKeyDown(task)}
                onOpen={() => setDetailId(task.id)}
              />
            ))}
          </BoardColumn>
        ))}
      </div>

      {detail && (
        <TaskDetailSheet task={detail} onClose={() => setDetailId(null)} />
      )}
    </BoardDnd>
  )
}
```

Note: `BoardCard` now renders its own `<li>`, so `Board` no longer wraps it.

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. `useGlobalShortcuts` ignores Alt-modified keys, so `Alt+arrows` never collide with `T`/`N`/`V`; the card handlers do not intercept `T`, `N` or `V`, so those keep working with a card focused.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: drag, keyboard and menus on the board"
```

---

### Task 6: Mobile board

**Files:**
- Create: `src/features/board/MobileBoard.tsx`
- Modify: `src/features/board/Board.tsx`
- Test: `src/features/board/__tests__/board.test.tsx`

**Interfaces:**
- Consumes: `TAB_PREFIX` (Task 2); `BoardCard` with `variant="mobile"`, `BoardColumn` (Tasks 4–5); the `columns` array and handlers built in `Board`.
- Produces: `<MobileBoard columns={…} renderCard={(task) => ReactNode} onAdd={(status, title) => void} />`.

- [ ] **Step 1: Write failing tests**

Append to `src/features/board/__tests__/board.test.tsx`:

```tsx
describe('mobile board', () => {
  it('shows one column at a time behind tabs with counts', async () => {
    seedStorage([
      makeTask({ title: 'Plan', date: TODAY }),
      makeTask({ title: 'Await', date: TODAY, status: 'waiting', order: 1 }),
    ])
    const user = userEvent.setup()
    renderApp({ desktop: false })
    await openBoard(user)

    const tabs = screen.getByRole('tablist', { name: 'Board columns' })
    expect(within(tabs).getByRole('tab', { name: 'Todo 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: cardName('Plan') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: cardName('Await') })).not.toBeInTheDocument()

    await user.click(within(tabs).getByRole('tab', { name: 'Waiting 1' }))
    expect(screen.getByRole('button', { name: cardName('Await') })).toBeInTheDocument()
  })

  it('moves a card from the detail sheet', async () => {
    seedStorage([makeTask({ title: 'Plan', date: TODAY })])
    const user = userEvent.setup()
    renderApp({ desktop: false })
    await openBoard(user)

    await user.click(screen.getByRole('button', { name: cardName('Plan') }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Waiting' }))

    expect(storedTasks()[0].status).toBe('waiting')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/features/board/__tests__/board.test.tsx`
Expected: FAIL — no tablist.

- [ ] **Step 3: Implement MobileBoard**

Create `src/features/board/MobileBoard.tsx`:

```tsx
import { useDroppable } from '@dnd-kit/core'
import { useRef, useState, type ReactNode } from 'react'
import { STATUS_LABEL } from '../../lib/status'
import type { BoardStatus, Task } from '../../types/task'
import { BoardColumn } from './BoardColumn'
import { TAB_PREFIX } from './boardModel'

interface Column {
  status: BoardStatus
  tasks: Task[]
}

/** Four columns do not fit a phone: one at a time, switched by tab or swipe. */
export function MobileBoard({
  columns,
  renderCard,
  onAdd,
}: {
  columns: Column[]
  renderCard: (task: Task) => ReactNode
  onAdd: (status: BoardStatus, title: string) => void
}) {
  const [index, setIndex] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const current = columns[index]

  return (
    <div className="px-4 pb-24">
      <div
        role="tablist"
        aria-label="Board columns"
        className="flex gap-1 overflow-x-auto pb-4"
      >
        {columns.map((column, i) => (
          <ColumnTab
            key={column.status}
            status={column.status}
            count={column.tasks.length}
            selected={i === index}
            onSelect={() => setIndex(i)}
          />
        ))}
      </div>

      <div
        role="tabpanel"
        aria-label={STATUS_LABEL[current.status]}
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          touchStart.current = null
          if (!start) return
          const touch = event.changedTouches[0]
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          // A clear horizontal flick; vertical scrolling and long-press drags pass.
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
          setIndex((i) => Math.max(0, Math.min(columns.length - 1, i + (dx < 0 ? 1 : -1))))
        }}
      >
        <BoardColumn
          status={current.status}
          count={current.tasks.length}
          ids={current.tasks.map((task) => task.id)}
          onAdd={(title) => onAdd(current.status, title)}
        >
          {current.tasks.map(renderCard)}
        </BoardColumn>
      </div>
    </div>
  )
}

/** A tab is also a drop target: dropping a card on it moves it to that column. */
function ColumnTab({
  status,
  count,
  selected,
  onSelect,
}: {
  status: BoardStatus
  count: number
  selected: boolean
  onSelect: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${TAB_PREFIX}${status}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] transition-colors ${
        selected || isOver ? 'bg-elevated text-text' : 'text-muted'
      }`}
    >
      {STATUS_LABEL[status]} <span className="text-muted">{count}</span>
    </button>
  )
}
```

The tab's accessible name is its text content, e.g. "Todo 1".

- [ ] **Step 4: Use it in Board**

In `src/features/board/Board.tsx`:

1. `import { MobileBoard } from './MobileBoard'`.
2. Extract the card render into a function inside `Board`:

```tsx
  const renderCard = (task: Task) => (
    <BoardCard
      key={task.id}
      task={task}
      today={planner.today}
      isFocused={focusId === task.id}
      isTabbable={(focusId ?? firstId) === task.id}
      onFocus={() => setFocusId(task.id)}
      onKeyDown={onCardKeyDown(task)}
      onOpen={() => setDetailId(task.id)}
      variant={isDesktop ? 'desktop' : 'mobile'}
    />
  )
```

3. Replace the `<div className={isDesktop ? … : …}> … </div>` block with:

```tsx
      {isDesktop ? (
        <div className="grid grid-cols-4 gap-6 px-10 pb-24">
          {columns.map(({ status, tasks }) => (
            <BoardColumn
              key={status}
              status={status}
              count={tasks.length}
              ids={tasks.map((task) => task.id)}
              onAdd={(title) => planner.createTask(addDate, title, status)}
            >
              {tasks.map(renderCard)}
            </BoardColumn>
          ))}
        </div>
      ) : (
        <MobileBoard
          columns={columns}
          renderCard={renderCard}
          onAdd={(status, title) => planner.createTask(addDate, title, status)}
        />
      )}
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: one-column board with tabs on mobile"
```

---

### Task 7: Docs and final check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

1. Under "Behaviour worth knowing", replace the **Rollover** bullet's "Every incomplete task" with "Every open task (Todo, In progress, Waiting)" and "Completed tasks and future tasks never move" with "Done, discarded and future tasks never move; a carried task keeps its status".
2. Change the **Storage** bullet to start "A single versioned `doto.state` key (version 2; version 1 stores are migrated on load: ticked tasks become Done)." and add a sentence: "The Week/Board choice lives separately under `doto.view`."
3. Add bullets after **Undo/redo**:

```markdown
- **Statuses.** A task is Todo, In progress, Waiting, Done or Discarded. The
  week's checkbox flips Done ↔ Todo. Discarding hides a task everywhere except
  the Discarded filter and search, where it can be restored.
- **Board.** Shows the visible week as four columns. Each column has its own
  order, independent of the day a task sits on; moving a card on the board
  never changes its day.
```

4. Add rows to the Keyboard table:

```markdown
| `V` | Switch between Week and Board |
| `Alt` + `←` `→` | Board: move the card to the previous / next column |
| `Alt` + `↑` `↓` | Board: move the card up / down its column |
```

and change the `Space` row to "Toggle Done".

5. In the Layout tree, add `    board/             status board: columns, cards, dnd, mobile tabs` under `features/`.

- [ ] **Step 2: Full verification**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green, build succeeds.

- [ ] **Step 3: Manual smoke check**

Run `pnpm dev`, open http://localhost:5173 at desktop width and at 390px, and check: toggle Week/Board; drag a card within and across columns; Alt+arrows; add a card in Waiting; discard and restore; a v1 store (seed `localStorage['doto.state']` with a `version: 1` payload) opens correctly.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: the board, statuses and their shortcuts"
```
