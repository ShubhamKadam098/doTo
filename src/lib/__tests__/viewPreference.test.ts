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
