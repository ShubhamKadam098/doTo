import { describe, expect, it } from 'vitest'
import {
  addWeeksToKey,
  formatWeekTitle,
  fromDateKey,
  isDateKey,
  startOfWeekKey,
  toDateKey,
  weekDayKeys,
} from '../date'

describe('date keys', () => {
  it('formats local dates without timezone drift', () => {
    expect(toDateKey(new Date(2026, 8, 6))).toBe('2026-09-06')
    expect(fromDateKey('2026-09-06').getDate()).toBe(6)
  })

  it('validates key shape and real calendar days', () => {
    expect(isDateKey('2026-09-06')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-9-6')).toBe(false)
    expect(isDateKey(20260906)).toBe(false)
  })

  it('starts weeks on Monday', () => {
    expect(startOfWeekKey('2026-09-06')).toBe('2026-08-31')
    expect(startOfWeekKey('2026-08-31')).toBe('2026-08-31')
  })

  it('lists seven consecutive days', () => {
    expect(weekDayKeys('2026-08-31')).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ])
  })

  it('navigates weeks in both directions across month ends', () => {
    expect(addWeeksToKey('2026-08-31', 1)).toBe('2026-09-07')
    expect(addWeeksToKey('2026-08-31', -1)).toBe('2026-08-24')
  })

  it('titles single-month and split-month weeks', () => {
    expect(formatWeekTitle('2026-09-07')).toBe('September 2026')
    expect(formatWeekTitle('2026-08-31')).toBe('Aug – Sep 2026')
    expect(formatWeekTitle('2026-12-28')).toBe('Dec 2026 – Jan 2027')
  })
})
