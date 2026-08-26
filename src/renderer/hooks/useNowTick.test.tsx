// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNowTick } from './useNowTick'

describe('useNowTick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 13, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function Probe({ onTick }: { onTick: (now: number) => void }) {
    onTick(useNowTick(30_000))
    return null
  }

  it('refreshes the timestamp on the configured interval', () => {
    const ticks: number[] = []
    render(<Probe onTick={(now) => ticks.push(now)} />)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    const first = ticks[ticks.length - 1]
    expect(first).toBe(Date.now())

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(ticks[ticks.length - 1]).toBeGreaterThan(first)
  })

  it('clears its interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<Probe onTick={() => undefined} />)
    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
