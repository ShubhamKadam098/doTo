import { safeStorage } from './storage'

export type View = 'week' | 'board'

/** A UI preference, kept out of task state so it never enters undo history. */
export const VIEW_KEY = 'doto.view'

export function loadView(storage: Storage | undefined = safeStorage()): View {
  try {
    return storage?.getItem(VIEW_KEY) === 'board' ? 'board' : 'week'
  } catch {
    return 'week'
  }
}

export function saveView(
  view: View,
  storage: Storage | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(VIEW_KEY, view)
  } catch {
    // Same as task storage: a blocked write must not break the app.
  }
}
