import { describe, expect, it } from 'vitest'
import type { HistoryEntry } from '../../shared/types/history'
import {
  formatEntryTime,
  formatRelativeTime,
  groupHistoryByDay,
  localDayKey
} from './history'

const NOW = new Date(2026, 7, 13, 12, 0, 0).getTime()

function entry(createdAt: number, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: `id-${createdAt}`,
    url: 'https://example.com/video',
    operation: 'INSPECTED',
    createdAt,
    ...overrides
  }
}

describe('localDayKey', () => {
  it('formats a timestamp using the local calendar day', () => {
    expect(localDayKey(new Date(2026, 7, 13, 23, 59).getTime())).toBe('2026-08-13')
    expect(localDayKey(new Date(2026, 7, 14, 0, 1).getTime())).toBe('2026-08-14')
  })
})

describe('formatRelativeTime', () => {
  it('formats sub-minute entries as Just now', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('Just now')
  })

  it('formats minutes as N min ago', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('5 min ago')
    expect(formatRelativeTime(NOW - 60_000, NOW)).toBe('1 min ago')
  })

  it('formats hours as N hours ago', () => {
    expect(formatRelativeTime(NOW - 2 * 3600_000, NOW)).toBe('2 hours ago')
    expect(formatRelativeTime(NOW - 3600_000, NOW)).toBe('1 hour ago')
  })
})

describe('formatEntryTime', () => {
  it('uses relative time for entries on the same local day', () => {
    expect(formatEntryTime(NOW - 5 * 60_000, NOW)).toBe('5 min ago')
  })

  it('uses a Yesterday label with the local time for the previous calendar day', () => {
    const yesterday = new Date(2026, 7, 12, 20, 30).getTime()
    expect(formatEntryTime(yesterday, NOW)).toMatch(/^Yesterday \d/)
  })

  it('includes a readable date for older entries', () => {
    const older = new Date(2026, 7, 10, 8, 15).getTime()
    expect(formatEntryTime(older, NOW)).toContain('2026')
  })
})

describe('groupHistoryByDay', () => {
  it('orders entries newest first inside each day group', () => {
    const newer = entry(new Date(2026, 7, 13, 10, 0).getTime())
    const older = entry(new Date(2026, 7, 13, 9, 0).getTime())
    const groups = groupHistoryByDay([older, newer], NOW)

    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].entries.map((item) => item.id)).toEqual([newer.id, older.id])
  })

  it('groups by local calendar day with Today, Yesterday, and readable labels', () => {
    const today = entry(new Date(2026, 7, 13, 10, 0).getTime())
    const yesterday = entry(new Date(2026, 7, 12, 20, 0).getTime())
    const older = entry(new Date(2026, 7, 10, 8, 0).getTime())

    const groups = groupHistoryByDay([older, today, yesterday], NOW)

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday', expect.stringContaining('2026')])
    expect(groups[0].entries.map((item) => item.id)).toEqual([today.id])
    expect(groups[1].entries.map((item) => item.id)).toEqual([yesterday.id])
    expect(groups[2].entries.map((item) => item.id)).toEqual([older.id])
  })

  it('orders day groups newest to oldest', () => {
    const today = entry(new Date(2026, 7, 13, 10, 0).getTime())
    const older = entry(new Date(2026, 7, 10, 8, 0).getTime())

    const groups = groupHistoryByDay([older, today], NOW)

    expect(groups[0].label).toBe('Today')
    expect(groups[1].label).not.toBe('Today')
  })
})
