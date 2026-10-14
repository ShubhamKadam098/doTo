# Kanban board view — design

Date: 2026-10-14
Status: approved; amended while planning (duplicate rule, menu shape, reveal)

## Goal

Let a task move through stages — Todo, In Progress, Waiting, Done — on a
board, and let a task be discarded without deleting it. The board is a second
lens on the same tasks the weekly planner already holds, not a separate app.

## Decisions

| Question | Decision |
| --- | --- |
| How the board relates to the week | The board shows the week currently being viewed. The user switches between **Week** and **Board**. |
| Columns | **Todo · In Progress · Waiting · Done**. Discard is an action, not a column. |
| Status in the week view | A small status pill beside the priority pill, only for In Progress and Waiting. Todo shows nothing, Done keeps its strikethrough, Discarded is hidden. |
| Card order in a column | Each column has its own manual order (`boardOrder`), independent of the day and the day's order. |
| Recovering discarded tasks | A fourth header filter, **Discarded**, in the week view; search also shows them. |

## 1. Data model

`src/types/task.ts`:

```ts
export const STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'discarded'] as const
export type Status = (typeof STATUSES)[number]

/** Statuses that appear as board columns, in display order. */
export const BOARD_STATUSES = ['todo', 'in_progress', 'waiting', 'done'] as const

export interface Task {
  id: string
  title: string
  date: string
  status: Status        // replaces `completed: boolean`
  priority: Priority
  order: number         // position within its day (unchanged)
  boardOrder: number    // position within its status column
  createdAt: string
  updatedAt: string
}

export type Filter = 'all' | 'active' | 'completed' | 'discarded'
```

`completed` is removed. Anything that read it derives from `status`:
done means `status === 'done'`; "open" means `todo | in_progress | waiting`.

### Filters

- **All** — every status except `discarded`.
- **Active** — `todo`, `in_progress`, `waiting`.
- **Completed** — `done`.
- **Discarded** — only `discarded`, each row offering Restore.

## 2. Domain operations (`src/lib/`, no React)

- `setStatus(tasks, id, status, toIndex?)` — sets the status, inserts the task
  into the target column at `toIndex` (bottom when omitted) and closes the gap in
  the source column. `boardOrder` stays contiguous `0..n-1` per status. Never
  changes `date` or `order`. Setting the same status with no index is a no-op.
- `reorderOnBoard(tasks, id, toIndex)` — moves a task within its own column.
  Never changes `date`, `order` or `status`.
- `toggleCompleted` becomes the done toggle: `done → todo`, any open status →
  `done` (landing at the bottom of the target column). `discarded` is unaffected.
- **Discard** is `setStatus(…, 'discarded')`. **Restore** is
  `setStatus(…, 'todo')`, landing at the bottom of Todo.
- `addTask` accepts an optional `status` (default `todo`) and appends the task
  to the bottom of that column.
- `duplicateTask`: an open task's copy keeps its status and sits directly after
  the original in both `order` and `boardOrder`; a done or discarded task's copy
  starts in Todo (bottom of the column), as copies never started completed before.
- `deleteTask` closes the gap in both the day and the column.
- **Rollover** moves tasks whose status is `todo`, `in_progress` or `waiting`
  and dated before today. `done` and `discarded` never move. `boardOrder` is
  untouched.

### Reducer (`src/features/tasks/taskReducer.ts`)

New actions, each committed as one undoable step:

```ts
| { type: 'setStatus'; id: string; status: Status; toIndex?: number }
| { type: 'reorderOnBoard'; id: string; toIndex: number }
```

`create` gains an optional `status`. `toggle` keeps its name and uses the new
rule. No-ops (same status, same index) return the existing state so they do not
create history entries.

## 3. Storage (`src/lib/storage.ts`)

`STORAGE_VERSION` goes from 1 to 2.

- `parseTask` reads `status`; an unknown or missing value falls back to `done`
  when a legacy `completed === true` is present, else `todo`.
- A missing or non-finite `boardOrder` is filled in after parsing.
- `migrate` normalises `boardOrder` per status, sorting by
  `(boardOrder if present, date, order)`, so a v1 store opens with each column
  in week order. This normalisation also runs on every load, repairing gaps or
  duplicates.
- One malformed record still costs only that record.

The selected view is a UI preference stored under its own key, `doto.view`
(`'week' | 'board'`), read and written defensively like `doto.state`. It is not
part of task state or undo history.

## 4. View switch

- `PlannerHeader` gains a segmented **Week | Board** control beside the week
  arrows. Global shortcut `V` toggles it (stands down while a text field has
  focus, like the other shortcuts).
- The week title, ← → week arrows and `T` work identically in both views; the
  board is scoped to the visible week (`weekStart … weekStart + 6`).
- The filter group is hidden in Board view.
- `Planner` renders `WeekGrid`/`MobileWeek` or the board depending on the view.

## 5. Board (`src/features/board/`)

### Desktop (≥ 900px)

- Four equal columns in `BOARD_STATUSES` order. Each header shows the column
  name and its card count.
- Cards are the week's tasks with that status, sorted by `boardOrder`.
- A card shows the title with the priority pill (same component as the week
  row) and a day label such as `Mon 12`, accented when the task is due today.
  Done cards are struck through.
- Each column ends in **+ Add task**. The new task takes that column's status
  and is dated today when today is in the visible week, otherwise the week's
  Monday.
- Empty columns show a quiet "Nothing here" and still accept drops.

### Interaction

- **Drag** with dnd-kit (its own `BoardDnd`, separate from `PlannerDnd`):
  vertical drops within a column dispatch `reorderOnBoard`; drops in another
  column dispatch `setStatus` with the drop index.
- **Click / Enter** opens `TaskDetailSheet`.
- **Context menu**: flat "Move to <status>" items for the other columns,
  Discard, Duplicate, Delete. Priority is set from the hover-revealed priority
  dot on the card (as on week rows) or keys `1`–`4`.
- `N` (new task) does nothing on the board; each column has its own Add.
- **Keyboard**:

| Key | Action |
| --- | --- |
| `↑` `↓` `←` `→` | Move focus between cards and columns |
| `Alt+←` `Alt+→` | Move the card to the previous / next column |
| `Alt+↑` `Alt+↓` | Reorder the card within its column |
| `Enter` | Open the detail sheet |
| `Space` | Toggle Done |
| `1` `2` `3` `4` | Priority |
| `Delete` / `Backspace` | Delete |

Board indexes are computed against the visible week's cards, then translated to
a `boardOrder` position among all tasks of that status, so cards from other
weeks keep their relative order.

### Mobile (< 900px)

- One column at a time. A tab strip shows each status with its count
  (`Todo 4 · In Progress 1 · Waiting 2 · Done 3`); tap a tab or swipe
  horizontally to change column.
- Long-press drag reorders within the column; dropping a card on a tab moves it
  to that status (bottom of the column).
- The card menu and detail sheet offer "Move to…", so no action requires drag.

## 6. Week view changes

- `TaskRow` shows a status pill after the priority pill for `in_progress`
  ("In progress") and `waiting` ("Waiting") only.
- Discarded tasks are excluded unless the Discarded filter is selected; in that
  filter rows show a Restore action and are read-only otherwise.
- The row context menu (flat "Move to <status>" items) and `TaskDetailSheet` gain a status picker
  (Todo / In Progress / Waiting / Done) and Discard (or Restore when discarded).
- Status changes from the week land at the bottom of the target column.

## 7. Search

`SearchDialog` includes discarded tasks, greyed with a "Discarded" tag.
Revealing one switches the filter to Discarded. Revealing any task from the
board switches to the Week view, since reveal focuses a week row.

## 8. Edge cases

- Rollover carries a task to today with its status and `boardOrder`; it leaves
  last week's board and appears on this week's.
- Deleting or discarding a card closes its column's gap.
- Every drag, status change, discard and restore is a single undo step.
- Dropping a card where it already is creates no history entry.

## 9. Testing

- `lib` unit tests: `setStatus`, `reorderOnBoard` (contiguous `boardOrder`,
  `date`/`order` untouched), done toggle rule, `addTask`/`duplicateTask`/
  `deleteTask` with `boardOrder`, rollover by status, v1 → v2 migration
  (`completed` mapping, `boardOrder` assignment, bad status → `todo`).
- Reducer tests: new actions undo/redo as one step; no-ops add no history.
- Integration tests (Testing Library): view switch and its persistence, add a
  task in a column, `Alt+→` changes status, `Alt+↓` reorders, discard then
  restore via the Discarded filter, week pill for In Progress and Waiting.
- Existing tests are updated from `completed` to `status`.
- README: keyboard table and behaviour notes updated for the board and statuses.

## Out of scope

Custom or renamable columns, WIP limits, a board across all dates, an undated
backlog.
