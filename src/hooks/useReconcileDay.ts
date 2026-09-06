import { useEffect, useRef } from 'react'
import { todayKey } from '../lib/date'

/**
 * Calls `onDayResolved` on load and whenever the app resumes (tab visible,
 * window focused, bfcache restore) or the calendar date changes underneath a
 * long-lived tab. Deliberately not a timer.
 */
export function useReconcileDay(onDayResolved: (today: string) => void): void {
  const callbackRef = useRef(onDayResolved)

  useEffect(() => {
    callbackRef.current = onDayResolved
  }, [onDayResolved])

  useEffect(() => {
    let lastSeen = ''

    const check = () => {
      const today = todayKey()
      if (today === lastSeen) return
      lastSeen = today
      callbackRef.current(today)
    }

    check()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }

    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('visibilitychange', onVisibility)
    // Cheap safety net for a tab left open across midnight.
    const interval = window.setInterval(check, 60_000)

    return () => {
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [])
}
