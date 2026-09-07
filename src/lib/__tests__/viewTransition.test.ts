import { afterEach, describe, expect, it, vi } from 'vitest'
import { withViewTransition } from '../viewTransition'

type Doc = { startViewTransition?: unknown }

function stubMotionPreference(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
}

afterEach(() => {
  delete (document as unknown as Doc).startViewTransition
  vi.unstubAllGlobals()
})

describe('withViewTransition', () => {
  it('applies the update even where the browser has no view transitions', () => {
    stubMotionPreference(false)
    const update = vi.fn()

    withViewTransition(update)

    expect(update).toHaveBeenCalledTimes(1)
  })

  it('routes the update through the browser when it is supported', () => {
    stubMotionPreference(false)
    const startViewTransition = vi.fn((update: () => void) => {
      update()
      return { finished: Promise.resolve() }
    })
    ;(document as unknown as Doc).startViewTransition = startViewTransition
    const update = vi.fn()

    withViewTransition(update)

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('skips the animation when the reader asked for less motion', () => {
    stubMotionPreference(true)
    const startViewTransition = vi.fn()
    ;(document as unknown as Doc).startViewTransition = startViewTransition
    const update = vi.fn()

    withViewTransition(update)

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
