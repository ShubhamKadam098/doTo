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
