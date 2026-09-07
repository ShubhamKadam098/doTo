import { flushSync } from 'react-dom'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Applies a state change so the browser can animate the layout it lands on —
 * rows sliding up to close the gap a deleted task leaves, for instance.
 *
 * The update has to land synchronously for the browser to capture both sides
 * of it, hence `flushSync`. Where view transitions are unsupported, or the
 * reader has asked for less motion, the update simply applies on its own.
 */
export function withViewTransition(update: () => void): void {
  // Typed as always present, but absent in browsers that predate the API.
  const start = document.startViewTransition as
    | Document['startViewTransition']
    | undefined

  if (!start || prefersReducedMotion()) {
    update()
    return
  }

  start.call(document, () => flushSync(update))
}
