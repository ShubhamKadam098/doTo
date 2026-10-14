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

  it('keeps a tab stop after the focused card is discarded', async () => {
    seedStorage([
      makeTask({ title: 'Plan', date: TODAY }),
      makeTask({ title: 'Build', date: TODAY, order: 1, boardOrder: 1 }),
    ])
    const user = userEvent.setup()
    renderApp()
    await openBoard(user)

    const plan = within(column('Todo')).getByRole('button', { name: cardName('Plan') })
    plan.focus()
    await user.pointer({ target: plan, keys: '[MouseRight]' })
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Discard' }))

    expect(
      within(column('Todo')).getByRole('button', { name: cardName('Build') }),
    ).toHaveAttribute('tabindex', '0')
  })
})
