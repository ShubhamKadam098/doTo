import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import {
  addDaysToKey,
  addWeeksToKey,
  formatDayNumber,
  formatFullDate,
  formatWeekdayLong,
  startOfWeekKey,
  todayKey,
} from '../../../lib/date'
import { STORAGE_KEY, type PersistedState } from '../../../lib/storage'
import type { Task } from '../../../types/task'

/* ------------------------------------------------------------------ *
 * Environment plumbing
 * ------------------------------------------------------------------ */

/** jsdom has no matchMedia; the planner picks desktop vs mobile from it. */
function stubMatchMedia(matches: boolean): void {
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

function makeTask(
  input: Partial<Task> & { title: string; date: string },
): Task {
  seq += 1
  const stamp = new Date(Date.UTC(2020, 0, 1, 0, 0, seq)).toISOString()
  return {
    id: `seed-${seq}`,
    completed: false,
    priority: 'none',
    order: 0,
    createdAt: stamp,
    updatedAt: stamp,
    ...input,
  }
}

function seedStorage(tasks: Task[]): void {
  const state: PersistedState = { version: 1, tasks, lastRolloverDate: null }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function storedTasks(): Task[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return []
  return (JSON.parse(raw) as PersistedState).tasks
}

function renderApp({ desktop = true } = {}) {
  stubMatchMedia(desktop)
  return render(<App />)
}

/* ------------------------------------------------------------------ *
 * Accessible-name helpers (mirror the markup exactly)
 * ------------------------------------------------------------------ */

const TODAY = todayKey()
const WEEK_START = startOfWeekKey(TODAY)

function dayName(date: string): string {
  return `${formatWeekdayLong(date)} ${formatDayNumber(date)}`
}

function daySection(date: string): HTMLElement {
  return screen.getByRole('region', { name: dayName(date) })
}

function rowName(
  title: string,
  date: string,
  { completed = false, priority = 'None' } = {},
): string {
  return `${title}. ${dayName(date)}. ${
    completed ? 'Completed' : 'Not completed'
  }. Priority ${priority}`
}

function emptyRowName(date: string): string {
  return `Add a task on ${dayName(date)}`
}

function titleInputName(date: string): string {
  return `Task title for ${dayName(date)}`
}

/** Where the DOM focus currently sits, as (day index, row index). */
function activeRow(): {
  dayIndex: number
  rowIndex: number
  label: string | null
} {
  const active = document.activeElement as HTMLElement | null
  const li = active?.closest('li') ?? null
  const section = li?.closest('section') ?? null
  const sections = Array.from(document.querySelectorAll('main section'))
  const rows = section ? Array.from(section.querySelectorAll('li')) : []
  return {
    dayIndex: section ? sections.indexOf(section) : -1,
    rowIndex: li ? rows.indexOf(li) : -1,
    label: section?.getAttribute('aria-label') ?? null,
  }
}

function rowCounts(): number[] {
  return screen
    .getAllByRole('region')
    .map((section) => within(section).getAllByRole('listitem').length)
}

function visibleDayLabels(): string[] {
  return screen
    .getAllByRole('region')
    .map((section) => section.getAttribute('aria-label') ?? '')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ *
 * 1. Row alignment
 * ------------------------------------------------------------------ */

describe('row alignment', () => {
  it('renders ten rows in every day column when there are no tasks', () => {
    renderApp()

    const counts = rowCounts()
    expect(counts).toHaveLength(7)
    expect(counts).toEqual(Array<number>(7).fill(10))
  })

  it('grows every column to the busiest day plus one', () => {
    seedStorage(
      Array.from({ length: 12 }, (_, index) =>
        makeTask({ title: `Task ${index + 1}`, date: TODAY, order: index }),
      ),
    )

    renderApp()

    const busy = daySection(TODAY)
    expect(within(busy).getAllByRole('listitem')).toHaveLength(13)

    const counts = rowCounts()
    expect(counts).toHaveLength(7)
    expect(counts).toEqual(Array<number>(7).fill(13))
    expect(new Set(counts).size).toBe(1)
  })
})

/* ------------------------------------------------------------------ *
 * 2. Create
 * ------------------------------------------------------------------ */

describe('creating a task', () => {
  it('collapses a click on a lower blank row onto the first free row', async () => {
    const user = userEvent.setup()
    seedStorage([makeTask({ id: 'a', title: 'Existing', date: TODAY, order: 0 })])
    renderApp()

    const section = daySection(TODAY)
    const blanks = within(section).getAllByRole('button', {
      name: emptyRowName(TODAY),
    })

    // Click the sixth blank row; the task would be appended at index 1 anyway.
    await user.click(blanks[5])

    const rows = within(daySection(TODAY)).getAllByRole('listitem')
    const editor = within(daySection(TODAY)).getByRole('textbox', {
      name: titleInputName(TODAY),
    })
    expect(rows[1]).toContainElement(editor)
    expect(document.activeElement).toBe(editor)
  })

  it('lets an empty editor pass undo through to the planner', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(
      within(daySection(TODAY)).getAllByRole('button', {
        name: emptyRowName(TODAY),
      })[0],
    )
    await user.type(
      within(daySection(TODAY)).getByRole('textbox', {
        name: titleInputName(TODAY),
      }),
      'Only task',
    )
    await user.keyboard('{Enter}')
    expect(storedTasks()).toHaveLength(1)

    // The caret now sits in the next (empty) editor - undo must still land.
    await user.keyboard('{Control>}z{/Control}')
    expect(storedTasks()).toHaveLength(0)
  })


  it('types a title into an empty row, persists it and advances the caret', async () => {
    const user = userEvent.setup()
    renderApp()

    const section = daySection(TODAY)
    const emptyRows = within(section).getAllByRole('button', {
      name: emptyRowName(TODAY),
    })
    expect(emptyRows).toHaveLength(10)

    await user.click(emptyRows[0])
    const input = within(section).getByRole('textbox', {
      name: titleInputName(TODAY),
    })
    await user.type(input, 'Write the brief')
    await user.keyboard('{Enter}')

    expect(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Write the brief', TODAY),
      }),
    ).toBeInTheDocument()

    // The caret lands in the next row's editor, so typing can continue.
    expect(document.activeElement).toHaveAccessibleName(titleInputName(TODAY))
    await user.type(document.activeElement as HTMLElement, 'Second one')
    await user.keyboard('{Enter}')
    expect(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Second one', TODAY),
      }),
    ).toBeInTheDocument()

    // Only real tasks reach storage - the remaining empty rows do not.
    const persisted = storedTasks()
    expect(persisted).toHaveLength(2)
    expect(persisted[0]).toMatchObject({
      title: 'Write the brief',
      date: TODAY,
      completed: false,
    })
    expect(persisted[1]).toMatchObject({ title: 'Second one', order: 1 })
  })
})

/* ------------------------------------------------------------------ *
 * 3. Edit
 * ------------------------------------------------------------------ */

describe('editing a task', () => {
  it('renames in place without changing the task id', async () => {
    seedStorage([makeTask({ title: 'Draft memo', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    const idBefore = storedTasks()[0].id

    await user.click(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Draft memo', TODAY),
      }),
    )

    const input = within(daySection(TODAY)).getByRole('textbox', {
      name: titleInputName(TODAY),
    })
    expect(input).toHaveValue('Draft memo')

    await user.clear(input)
    await user.type(input, 'Final memo')
    await user.keyboard('{Enter}')

    expect(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Final memo', TODAY),
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: rowName('Draft memo', TODAY) }),
    ).not.toBeInTheDocument()

    const persisted = storedTasks()
    expect(persisted).toHaveLength(1)
    expect(persisted[0].id).toBe(idBefore)
    expect(persisted[0].title).toBe('Final memo')
  })
})

/* ------------------------------------------------------------------ *
 * 4. Completion
 * ------------------------------------------------------------------ */

describe('completing a task', () => {
  it('toggles with Space and keeps the task in the same day', async () => {
    seedStorage([makeTask({ title: 'Ship the deck', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    // "Today" parks the caret on the first row of today.
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(document.activeElement).toHaveAccessibleName(
      rowName('Ship the deck', TODAY),
    )

    await user.keyboard('[Space]')

    const section = daySection(TODAY)
    const completedRow = within(section).getByRole('button', {
      name: rowName('Ship the deck', TODAY, { completed: true }),
    })
    expect(completedRow).toBeInTheDocument()
    expect(section).toContainElement(completedRow)
    expect(storedTasks()[0].completed).toBe(true)

    // And back again.
    await user.keyboard('[Space]')
    expect(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Ship the deck', TODAY),
      }),
    ).toBeInTheDocument()
    expect(storedTasks()[0].completed).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * 5. Filters
 * ------------------------------------------------------------------ */

describe('filters', () => {
  it('narrows the view without mutating the stored tasks', async () => {
    seedStorage([
      makeTask({ title: 'Still open', date: TODAY, order: 0 }),
      makeTask({ title: 'All done', date: TODAY, order: 1, completed: true }),
    ])
    const user = userEvent.setup()
    renderApp()

    const group = screen.getByRole('radiogroup', { name: 'Filter tasks' })
    const activeOption = within(group).getByRole('radio', { name: 'Active' })
    const completedOption = within(group).getByRole('radio', {
      name: 'Completed',
    })
    const allOption = within(group).getByRole('radio', { name: 'All' })

    const open = rowName('Still open', TODAY)
    const done = rowName('All done', TODAY, { completed: true })

    expect(screen.getByRole('button', { name: open })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: done })).toBeInTheDocument()

    await user.click(activeOption)
    expect(activeOption).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: open })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: done })).not.toBeInTheDocument()

    await user.click(completedOption)
    expect(screen.queryByRole('button', { name: open })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: done })).toBeInTheDocument()

    await user.click(allOption)
    expect(screen.getByRole('button', { name: open })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: done })).toBeInTheDocument()

    const persisted = storedTasks()
    expect(persisted).toHaveLength(2)
    expect(persisted.map((task) => task.title).sort()).toEqual([
      'All done',
      'Still open',
    ])
  })
})

/* ------------------------------------------------------------------ *
 * 6. Search
 * ------------------------------------------------------------------ */

describe('search', () => {
  it('finds a task in another week and navigates to it', async () => {
    const otherWeekDate = addDaysToKey(addWeeksToKey(WEEK_START, 1), 2)
    seedStorage([makeTask({ title: 'Quarterly review', date: otherWeekDate })])
    const user = userEvent.setup()
    renderApp()

    expect(
      screen.queryByRole('region', { name: dayName(otherWeekDate) }),
    ).not.toBeInTheDocument()

    await user.keyboard('{Control>}k{/Control}')

    const dialog = screen.getByRole('dialog', { name: 'Search tasks' })
    const searchInput = within(dialog).getByRole('textbox', {
      name: 'Search all tasks',
    })
    await user.type(searchInput, 'quarterly')

    const option = within(dialog).getByRole('option', {
      name: /Quarterly review/,
    })
    expect(option).toHaveTextContent(formatFullDate(otherWeekDate))

    await user.keyboard('{Enter}')

    expect(
      screen.queryByRole('dialog', { name: 'Search tasks' }),
    ).not.toBeInTheDocument()
    expect(
      within(daySection(otherWeekDate)).getByRole('button', {
        name: rowName('Quarterly review', otherWeekDate),
      }),
    ).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ *
 * 7. Week navigation
 * ------------------------------------------------------------------ */

describe('week navigation', () => {
  it('returns to the starting week via Previous week and via Today', async () => {
    const user = userEvent.setup()
    renderApp()

    const originalDays = visibleDayLabels()
    expect(originalDays[0]).toBe(dayName(WEEK_START))

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    const nextDays = visibleDayLabels()
    expect(nextDays).not.toEqual(originalDays)
    expect(nextDays[0]).toBe(dayName(addWeeksToKey(WEEK_START, 1)))

    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(visibleDayLabels()).toEqual(originalDays)

    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(visibleDayLabels()[0]).toBe(dayName(addWeeksToKey(WEEK_START, -1)))

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(visibleDayLabels()).toEqual(originalDays)
  })
})

/* ------------------------------------------------------------------ *
 * 8. Undo / redo
 * ------------------------------------------------------------------ */

describe('undo and redo', () => {
  it('undoes and redoes a creation from the keyboard', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(
      within(daySection(TODAY)).getAllByRole('button', {
        name: emptyRowName(TODAY),
      })[0],
    )
    await user.type(
      within(daySection(TODAY)).getByRole('textbox', {
        name: titleInputName(TODAY),
      }),
      'Undo me',
    )
    await user.keyboard('{Enter}')

    const created = rowName('Undo me', TODAY)
    expect(screen.getByRole('button', { name: created })).toBeInTheDocument()

    await user.keyboard('{Control>}z{/Control}')
    expect(
      screen.queryByRole('button', { name: created }),
    ).not.toBeInTheDocument()
    expect(storedTasks()).toHaveLength(0)

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(screen.getByRole('button', { name: created })).toBeInTheDocument()
    expect(storedTasks()).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ *
 * 9. Keyboard navigation and editing keys
 * ------------------------------------------------------------------ */

describe('keyboard navigation', () => {
  it('moves down a row and across to the next day', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Today' }))

    // Walk to the first column so ArrowRight never clamps at the week edge.
    await user.keyboard('{ArrowLeft}'.repeat(6))
    expect(activeRow()).toMatchObject({ dayIndex: 0, rowIndex: 0 })

    await user.keyboard('{ArrowDown}')
    expect(activeRow()).toMatchObject({ dayIndex: 0, rowIndex: 1 })

    await user.keyboard('{ArrowRight}')
    expect(activeRow()).toMatchObject({ dayIndex: 1, rowIndex: 1 })
    expect(activeRow().label).toBe(dayName(addDaysToKey(WEEK_START, 1)))

    await user.keyboard('{ArrowUp}')
    expect(activeRow()).toMatchObject({ dayIndex: 1, rowIndex: 0 })
  })

  it('types a space into the title instead of toggling completion', async () => {
    seedStorage([makeTask({ title: 'alpha', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.click(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('alpha', TODAY),
      }),
    )

    const input = within(daySection(TODAY)).getByRole('textbox', {
      name: titleInputName(TODAY),
    })
    await user.type(input, ' beta gamma')
    expect(input).toHaveValue('alpha beta gamma')

    await user.keyboard('{Enter}')

    expect(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('alpha beta gamma', TODAY),
      }),
    ).toBeInTheDocument()
    expect(storedTasks()[0].completed).toBe(false)
  })

  it('cancels an edit with Escape without saving', async () => {
    seedStorage([makeTask({ title: 'keep me', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.click(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('keep me', TODAY),
      }),
    )
    await user.type(
      within(daySection(TODAY)).getByRole('textbox', {
        name: titleInputName(TODAY),
      }),
      ' and change me',
    )
    await user.keyboard('{Escape}')

    expect(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('keep me', TODAY),
      }),
    ).toBeInTheDocument()
    const persisted = storedTasks()
    expect(persisted).toHaveLength(1)
    expect(persisted[0].title).toBe('keep me')
  })
})

/* ------------------------------------------------------------------ *
 * 10. Rollover
 * ------------------------------------------------------------------ */

describe('rollover on mount', () => {
  it('carries an incomplete task to today and leaves a completed one behind', async () => {
    const pastDate = addDaysToKey(TODAY, -3)
    seedStorage([
      makeTask({ title: 'Rollover me', date: pastDate, order: 0 }),
      makeTask({
        title: 'Stayed put',
        date: pastDate,
        order: 1,
        completed: true,
      }),
    ])
    const user = userEvent.setup()
    renderApp()

    expect(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Rollover me', TODAY),
      }),
    ).toBeInTheDocument()

    const persisted = storedTasks()
    expect(persisted.find((task) => task.title === 'Rollover me')?.date).toBe(
      TODAY,
    )
    expect(persisted.find((task) => task.title === 'Stayed put')?.date).toBe(
      pastDate,
    )

    // The three-day-old day may sit in the previous week; navigate if so.
    expect(startOfWeekKey(pastDate) === WEEK_START).toBe(
      screen.queryByRole('region', { name: dayName(pastDate) }) !== null,
    )
    if (startOfWeekKey(pastDate) !== WEEK_START) {
      await user.click(screen.getByRole('button', { name: 'Previous week' }))
    }

    const pastSection = daySection(pastDate)
    expect(
      within(pastSection).getByRole('button', {
        name: rowName('Stayed put', pastDate, { completed: true }),
      }),
    ).toBeInTheDocument()
    expect(
      within(pastSection).queryByRole('button', {
        name: rowName('Rollover me', pastDate),
      }),
    ).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ *
 * 11. Mobile
 * ------------------------------------------------------------------ */

describe('mobile layout', () => {
  it('renders a vertical timeline and edits a task from the detail sheet', async () => {
    seedStorage([makeTask({ title: 'Standup', date: TODAY })])
    const user = userEvent.setup()
    renderApp({ desktop: false })

    // Mobile is a timeline: each day shows only its tasks plus one blank row.
    expect(screen.getAllByRole('region')).toHaveLength(7)
    expect(within(daySection(TODAY)).getAllByRole('listitem')).toHaveLength(2)
    const otherDay =
      WEEK_START === TODAY ? addDaysToKey(WEEK_START, 1) : WEEK_START
    expect(within(daySection(otherDay)).getAllByRole('listitem')).toHaveLength(1)

    await user.click(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Standup', TODAY),
      }),
    )

    let dialog = screen.getByRole('dialog', { name: 'Task: Standup' })
    const titleField = within(dialog).getByRole('textbox', {
      name: 'Task title',
    })
    await user.clear(titleField)
    await user.type(titleField, 'Standup notes')
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(storedTasks()[0].title).toBe('Standup notes')

    await user.click(
      within(daySection(TODAY)).getByRole('button', {
        name: rowName('Standup notes', TODAY),
      }),
    )
    dialog = screen.getByRole('dialog', { name: 'Task: Standup notes' })

    await user.click(within(dialog).getByRole('button', { name: 'High' }))
    expect(within(dialog).getByRole('button', { name: 'High' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(storedTasks()[0].priority).toBe('high')

    await user.click(
      within(dialog).getByRole('button', { name: 'Mark as completed' }),
    )
    expect(
      within(dialog).getByRole('button', { name: 'Mark as not completed' }),
    ).toBeInTheDocument()
    expect(storedTasks()[0].completed).toBe(true)

    await user.click(within(dialog).getByRole('button', { name: 'Delete task' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: rowName('Standup notes', TODAY, {
          completed: true,
          priority: 'High',
        }),
      }),
    ).not.toBeInTheDocument()
    expect(storedTasks()).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ *
 * Desktop delete affordances
 * ------------------------------------------------------------------ */

describe('deleting from a desktop row', () => {
  it('deletes from the hover trash in one click', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Delete "Groceries"' }))

    expect(
      screen.queryByRole('button', { name: rowName('Groceries', TODAY) }),
    ).not.toBeInTheDocument()
    expect(storedTasks()).toHaveLength(0)
  })

  it('keeps the trash reachable while the row is being edited', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.click(
      screen.getByRole('button', { name: rowName('Groceries', TODAY) }),
    )
    expect(
      screen.getByRole('textbox', { name: titleInputName(TODAY) }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete "Groceries"' }))

    expect(storedTasks()).toHaveLength(0)
  })

  it('does not pull focus off the editor when the trash is pressed', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.click(
      screen.getByRole('button', { name: rowName('Groceries', TODAY) }),
    )
    const input = screen.getByRole('textbox', { name: titleInputName(TODAY) })

    // A blur here would commit the title and re-render the button out from
    // under the pointer, so the click would never land.
    await user.pointer({
      target: screen.getByRole('button', { name: 'Delete "Groceries"' }),
      keys: '[MouseLeft>]',
    })

    expect(input).toHaveFocus()
  })

  it('carries an open editor along when a task above it is deleted', async () => {
    seedStorage([
      makeTask({ title: 'Alpha', date: TODAY, order: 0 }),
      makeTask({ title: 'Beta', date: TODAY, order: 1 }),
      makeTask({ title: 'Gamma', date: TODAY, order: 2 }),
    ])
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: rowName('Gamma', TODAY) }))
    expect(
      screen.getByRole('textbox', { name: titleInputName(TODAY) }),
    ).toHaveValue('Gamma')

    await user.click(screen.getByRole('button', { name: 'Delete "Alpha"' }))

    // Gamma is a row higher now; the editor should have gone up with it
    // rather than staying put and picking up whatever landed in its place.
    const input = screen.getByRole('textbox', { name: titleInputName(TODAY) })
    expect(input).toHaveValue('Gamma')

    const rows = within(daySection(TODAY)).getAllByRole('listitem')
    expect(rows.indexOf(input.closest('li')!)).toBe(1)
  })

  it('keeps typed-but-uncommitted text when a task above is deleted', async () => {
    seedStorage([
      makeTask({ title: 'Alpha', date: TODAY, order: 0 }),
      makeTask({ title: 'Beta', date: TODAY, order: 1 }),
      makeTask({ title: 'Gamma', date: TODAY, order: 2 }),
    ])
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: rowName('Gamma', TODAY) }))
    await user.keyboard(' rewritten')
    expect(
      screen.getByRole('textbox', { name: titleInputName(TODAY) }),
    ).toHaveValue('Gamma rewritten')

    await user.click(screen.getByRole('button', { name: 'Delete "Alpha"' }))

    expect(
      screen.getByRole('textbox', { name: titleInputName(TODAY) }),
    ).toHaveValue('Gamma rewritten')
  })

  it('keeps a half-typed new task when a task above is deleted', async () => {
    seedStorage([makeTask({ title: 'Alpha', date: TODAY, order: 0 })])
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getAllByRole('button', { name: emptyRowName(TODAY) })[0])
    await user.keyboard('Brand new')
    expect(
      screen.getByRole('textbox', { name: titleInputName(TODAY) }),
    ).toHaveValue('Brand new')

    await user.click(screen.getByRole('button', { name: 'Delete "Alpha"' }))

    expect(
      screen.getByRole('textbox', { name: titleInputName(TODAY) }),
    ).toHaveValue('Brand new')
  })

  it('keeps the row trash off mobile, where the sheet owns deletion', () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    renderApp({ desktop: false })

    expect(
      screen.queryByRole('button', { name: 'Delete "Groceries"' }),
    ).not.toBeInTheDocument()
  })

  it('deletes from the right-click menu', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.pointer({
      target: screen.getByRole('button', { name: rowName('Groceries', TODAY) }),
      keys: '[MouseRight]',
    })
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Delete',
      }),
    )

    expect(storedTasks()).toHaveLength(0)
  })

  it('duplicates from the right-click menu', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.pointer({
      target: screen.getByRole('button', { name: rowName('Groceries', TODAY) }),
      keys: '[MouseRight]',
    })
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Duplicate',
      }),
    )

    const stored = storedTasks()
    expect(stored).toHaveLength(2)
    expect(stored.map((task) => task.title)).toEqual(['Groceries', 'Groceries'])
  })

  it('offers no menu on a blank row', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.pointer({
      target: screen.getAllByRole('button', { name: emptyRowName(TODAY) })[0],
      keys: '[MouseRight]',
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('deletes with Ctrl+Backspace without leaving edit mode first', async () => {
    seedStorage([makeTask({ title: 'Groceries', date: TODAY })])
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: rowName('Groceries', TODAY) }))
    expect(
      screen.getByRole('textbox', { name: titleInputName(TODAY) }),
    ).toHaveValue('Groceries')

    await user.keyboard('{Control>}{Backspace}{/Control}')

    expect(storedTasks()).toHaveLength(0)
  })
})
