import { describe, expect, it } from 'vitest'
import { createBroadcastThrottle } from './broadcast-throttle'
import type { Download } from '../../shared/types/download'

function download(status: Download['status'], id = 'dl-1'): Download {
  return {
    id,
    url: 'https://example.com/watch?v=1',
    formatId: '18',
    status,
    progress: { percent: 50 },
    directory: 'D:\\Downloads',
    createdAt: 0,
    updatedAt: 0
  }
}

describe('createBroadcastThrottle', () => {
  it('passes streaming updates through at most once per interval', () => {
    let time = 1_000
    const throttle = createBroadcastThrottle(200, () => time)

    expect(throttle.shouldSend(download('downloading'))).toBe(true)
    time += 100
    expect(throttle.shouldSend(download('downloading'))).toBe(false)
    time += 150
    expect(throttle.shouldSend(download('downloading'))).toBe(true)
  })

  it('throttles each download independently', () => {
    const throttle = createBroadcastThrottle(200)

    expect(throttle.shouldSend(download('downloading', 'a'))).toBe(true)
    expect(throttle.shouldSend(download('downloading', 'b'))).toBe(true)
    expect(throttle.shouldSend(download('downloading', 'a'))).toBe(false)
  })

  it('always sends non-streaming transitions immediately', () => {
    let time = 1_000
    const throttle = createBroadcastThrottle(200, () => time)
    expect(throttle.shouldSend(download('downloading'))).toBe(true)
    time += 10

    for (const status of [
      'queued',
      'inspecting',
      'paused',
      'completed',
      'failed',
      'cancelled'
    ] as const) {
      expect(throttle.shouldSend(download(status))).toBe(true)
    }
  })

  it('restarts the interval after a terminal transition', () => {
    const throttle = createBroadcastThrottle(200)

    expect(throttle.shouldSend(download('downloading'))).toBe(true)
    expect(throttle.shouldSend(download('completed'))).toBe(true)
    expect(throttle.shouldSend(download('downloading'))).toBe(true)
  })
})
