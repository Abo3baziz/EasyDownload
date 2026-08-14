// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryEntry } from '../../shared/types/history'
import type { PreloadApi } from '../../shared/types/preload'
import { HistoryStateProvider } from '../state/historyState'
import { HistorySection } from './HistorySection'

const NOW = new Date(2026, 7, 13, 12, 0, 0).getTime()

function createApiMock(): PreloadApi {
  return {
    inspectUrl: vi.fn(),
    startDownload: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    cancelDownload: vi.fn(),
    retryDownload: vi.fn(),
    getDownload: vi.fn(),
    listDownloads: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    clearHistory: vi.fn(),
    selectDirectory: vi.fn(),
    openFile: vi.fn(),
    openDirectory: vi.fn(),
    openFileLocation: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getDependencies: vi.fn(),
    startConversion: vi.fn(),
    cancelConversion: vi.fn(),
    listConversions: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    onDownloadStateChange: vi.fn(() => () => undefined),
    onConversionStateChange: vi.fn(() => () => undefined),
    listInspectionHistory: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    onInspectionHistoryChange: vi.fn(() => () => undefined)
  }
}

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'e1',
    url: 'https://example.com/video',
    operation: 'INSPECTED',
    createdAt: NOW,
    ...overrides
  }
}

describe('HistorySection', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 13, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function renderSection() {
    render(
      <HistoryStateProvider>
        <HistorySection />
      </HistoryStateProvider>
    )
    await act(async () => {})
  }

  it('shows an empty state when there is no history', async () => {
    await renderSection()

    expect(screen.getByText(/No history yet/)).toBeInTheDocument()
  })

  it('renders entries under Today with a relative time and the thumbnail', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        entry({
          url: 'https://example.com/video',
          thumbnail: 'https://example.com/thumb.jpg',
          createdAt: new Date(2026, 7, 13, 11, 55).getTime()
        })
      ]
    })

    await renderSection()

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/video')).toBeInTheDocument()
    expect(screen.getByText('Inspected · 5 min ago')).toBeInTheDocument()
    expect(screen.getByTitle('https://example.com/video')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'URL thumbnail' })).toHaveAttribute(
      'src',
      'https://example.com/thumb.jpg'
    )
  })

  it('shows a fallback when no thumbnail is available', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ thumbnail: undefined })]
    })

    await renderSection()

    expect(screen.getByText('No thumbnail')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'URL thumbnail' })).toBeNull()
  })

  it('groups the previous calendar day under Yesterday', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ createdAt: new Date(2026, 7, 12, 20, 30).getTime() })]
    })

    await renderSection()

    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText(/Inspected · Yesterday/)).toBeInTheDocument()
  })

  it('shows a readable date for older groups', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ createdAt: new Date(2026, 7, 10, 8, 0).getTime() })]
    })

    await renderSection()

    expect(screen.queryByText('Today')).toBeNull()
    expect(screen.queryByText('Yesterday')).toBeNull()
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0)
  })

  it('orders the newest entry first', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        entry({ id: 'older', url: 'https://example.com/older', createdAt: NOW - 3600_000 }),
        entry({ id: 'newer', url: 'https://example.com/newer', createdAt: NOW - 60_000 })
      ]
    })

    await renderSection()

    const urls = screen
      .getAllByTitle(/https:\/\/example\.com/)
      .map((node) => node.textContent)
    expect(urls).toEqual(['https://example.com/newer', 'https://example.com/older'])
  })

  it('adds a new entry automatically when an inspection completes', async () => {
    let listener: ((item: HistoryEntry) => void) | undefined
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ id: 'first', url: 'https://example.com/first' })]
    })
    window.mediaDownloader.onInspectionHistoryChange = vi.fn((callback) => {
      listener = callback
      return () => undefined
    })

    await renderSection()
    expect(screen.getByText('https://example.com/first')).toBeInTheDocument()

    act(() => {
      listener?.(
        entry({
          id: 'second',
          url: 'https://example.com/second',
          createdAt: NOW + 1
        })
      )
    })

    expect(screen.getByText('https://example.com/second')).toBeInTheDocument()
  })
})
