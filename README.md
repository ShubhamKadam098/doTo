# doTo

A minimalist, local-first weekly task planner. Everything lives in the browser:
no backend, no accounts, no sync.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # vitest
pnpm lint
pnpm build      # tsc -b && vite build
```

## Behaviour worth knowing

- **Row alignment.** Every desktop column renders the same number of rows —
  `max(10, busiest visible day + 1)`. Empty rows are UI only and are never
  persisted.
- **Rollover.** Every open task (Todo, In progress, Waiting) dated before today
  moves to today. This is reconciled when the app loads, regains focus, or
  becomes visible again (plus a minute poll to catch midnight in an idle tab) —
  never by a scheduled timer. Done, discarded and future tasks never move, a
  carried task keeps its status, and ids are preserved.
- **Storage.** A single versioned `doto.state` key (version 2; version 1 stores
  are migrated on load: ticked tasks become Done). Each record is validated on
  read, so one malformed task costs that task rather than the whole planner.
  The Week/Board choice lives separately under `doto.view`.
- **Undo/redo** covers every meaningful mutation, including drag/drop and
  rollover. A title edit commits as one step, not one per keystroke.
- **Statuses.** A task is Todo, In progress, Waiting, Done or Discarded. The
  week's checkbox flips Done ↔ Todo. Discarding hides a task everywhere except
  the Discarded filter and search, where it can be restored.
- **Board.** Shows the visible week as four columns. Each column has its own
  order, independent of the day a task sits on; moving a card on the board
  never changes its day.

## Keyboard

| Key | Action |
| --- | --- |
| `↑` `↓` | Move between rows |
| `←` `→` | Move between days |
| `Enter` | Edit the row / commit and move down |
| `Esc` | Cancel editing |
| `Space` | Toggle Done |
| `Delete` / `Backspace` | Delete the task |
| `1` `2` `3` `4` | Priority: none / low / medium / high |
| `Ctrl/Cmd + K` | Search all tasks |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `T` | Go to today |
| `N` | New task |
| `V` | Switch between Week and Board |
| `Alt` + `←` `→` | Board: move the card to the previous / next column |
| `Alt` + `↑` `↓` | Board: move the card up / down its column |

Shortcuts stand down while a text field has focus, so typing (spaces included)
always behaves normally.

## Layout

```
src/
  components/          shared UI primitives (icons, buttons, priority menu)
  features/
    planner/           desktop grid, mobile timeline, rows, dnd, focus
    board/             status board: columns, cards, dnd, mobile tabs
    search/            global search dialog
    tasks/             store: reducer, undo/redo history, persistence
  hooks/               media queries, global shortcuts, day reconciliation
  lib/                 dates, task operations, rollover, storage, search
  types/               the Task model
```

Domain logic (`lib/`, `features/tasks/`) has no React or DOM dependencies and
holds the test suite; components stay presentational.
