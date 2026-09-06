import { useEffect, useRef } from 'react'

export interface ShortcutHandlers {
  onSearch: () => void
  onUndo: () => void
  onRedo: () => void
  onToday: () => void
  onNewTask: () => void
}

/** True while the user is typing, so single-letter shortcuts stay out of the way. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function useGlobalShortcuts(
  handlers: ShortcutHandlers,
  enabled = true,
): void {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A row or dialog that already consumed the key wins.
      if (event.defaultPrevented) return

      const modifier = event.metaKey || event.ctrlKey
      const handlers = handlersRef.current

      // Search stays reachable from anywhere, including mid-edit.
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        handlers.onSearch()
        return
      }

      if (!enabled) return

      // Inside a text field, leave undo/redo and letters to the browser.
      if (isTextEntry(event.target)) return

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) handlers.onRedo()
        else handlers.onUndo()
        return
      }

      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handlers.onRedo()
        return
      }

      if (modifier || event.altKey) return

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault()
        handlers.onToday()
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        handlers.onNewTask()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
