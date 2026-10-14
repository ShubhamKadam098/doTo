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
