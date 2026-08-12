export function formatDuration(seconds?: number): string {
  if (seconds === undefined || Number.isNaN(seconds) || seconds < 0) {
    return ''
  }
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mm = minutes.toString().padStart(2, '0')
  const ss = secs.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || Number.isNaN(bytes) || bytes < 0) {
    return ''
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < units.length - 1)
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unitIndex]}`
}

export function formatDate(timestamp?: number): string {
  if (timestamp === undefined || Number.isNaN(timestamp) || timestamp < 0) {
    return ''
  }
  return new Date(timestamp).toISOString().slice(0, 10)
}
