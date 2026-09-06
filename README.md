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
- **Rollover.** Every incomplete task dated before today moves to today. This is
  reconciled when the app loads, regains focus, or becomes visible again (plus a
  minute poll to catch midnight in an idle tab) — never by a scheduled timer.
  Completed tasks and future tasks never move, and ids are preserved.
- **Storage.** A single versioned `doto.state` key. Each record is validated on
  read, so one malformed task costs that task rather than the whole planner.
- **Undo/redo** covers every meaningful mutation, including drag/drop and
  rollover. A title edit commits as one step, not one per keystroke.

## Keyboard

| Key | Action |
| --- | --- |
| `↑` `↓` | Move between rows |
| `←` `→` | Move between days |
| `Enter` | Edit the row / commit and move down |
| `Esc` | Cancel editing |
| `Space` | Toggle completion |
| `Delete` / `Backspace` | Delete the task |
| `1` `2` `3` `4` | Priority: none / low / medium / high |
| `Ctrl/Cmd + K` | Search all tasks |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `T` | Go to today |
| `N` | New task |

Shortcuts stand down while a text field has focus, so typing (spaces included)
always behaves normally.

## Layout

```
src/
  components/          shared UI primitives (icons, buttons, priority menu)
  features/
    planner/           desktop grid, mobile timeline, rows, dnd, focus
    search/            global search dialog
    tasks/             store: reducer, undo/redo history, persistence
  hooks/               media queries, global shortcuts, day reconciliation
  lib/                 dates, task operations, rollover, storage, search
  types/               the Task model
```

Domain logic (`lib/`, `features/tasks/`) has no React or DOM dependencies and
holds the test suite; components stay presentational.
