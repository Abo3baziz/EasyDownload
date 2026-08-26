import type { Download } from '../../shared/types/download'

const STREAMING_STATUSES: Download['status'][] = ['downloading', 'processing']

export interface BroadcastThrottle {
  shouldSend(download: Download): boolean
}

export function createBroadcastThrottle(
  minIntervalMs: number,
  now: () => number = Date.now
): BroadcastThrottle {
  const lastSentAt = new Map<string, number>()

  return {
    shouldSend(download: Download): boolean {
      if (!STREAMING_STATUSES.includes(download.status)) {
        lastSentAt.delete(download.id)
        return true
      }
      const timestamp = now()
      const last = lastSentAt.get(download.id)
      if (last !== undefined && timestamp - last < minIntervalMs) {
        return false
      }
      lastSentAt.set(download.id, timestamp)
      return true
    }
  }
}
