import type { HistoryEntry } from '../../shared/types/history'

export interface HistoryDayGroup {
  key: string
  label: string
  entries: HistoryEntry[]
}

export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffMs = now - timestamp
  if (diffMs < 60_000) {
    return 'Just now'
  }
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) {
    return `${minutes} min ago`
  }
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

export function formatLocalTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function formatLocalDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function localDayKeyOffset(now: number, days: number): string {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  return localDayKey(date.getTime())
}

export function formatEntryTime(timestamp: number, now: number = Date.now()): string {
  const key = localDayKey(timestamp)
  if (key === localDayKey(now)) {
    return formatRelativeTime(timestamp, now)
  }
  if (key === localDayKeyOffset(now, -1)) {
    return `Yesterday ${formatLocalTime(timestamp)}`
  }
  return `${formatLocalDate(timestamp)} · ${formatLocalTime(timestamp)}`
}

export function groupHistoryByDay(
  entries: HistoryEntry[],
  now: number = Date.now()
): HistoryDayGroup[] {
  const todayKey = localDayKey(now)
  const yesterdayKey = localDayKeyOffset(now, -1)
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt)
  const groups = new Map<string, HistoryEntry[]>()
  for (const entry of sorted) {
    const key = localDayKey(entry.createdAt)
    const list = groups.get(key) ?? []
    list.push(entry)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([key, groupEntries]) => ({
      key,
      label:
        key === todayKey
          ? 'Today'
          : key === yesterdayKey
            ? 'Yesterday'
            : formatLocalDate(groupEntries[0].createdAt),
      entries: groupEntries
    }))
    .sort((a, b) => (a.key < b.key ? 1 : -1))
}
