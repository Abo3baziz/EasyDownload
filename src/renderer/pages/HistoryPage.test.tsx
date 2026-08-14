// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreloadApi } from '../../shared/types/preload'
import { HistoryStateProvider } from '../state/historyState'
import { HistoryPage } from './HistoryPage'

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

function renderPage() {
  render(
    <HistoryStateProvider>
      <HistoryPage />
    </HistoryStateProvider>
  )
}

describe('HistoryPage', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 13, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the history page with an empty state', async () => {
    renderPage()
    await act(async () => {})

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByText(/No history yet/)).toBeInTheDocument()
  })

  it('renders persisted history entries', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'e1',
          url: 'https://example.com/video',
          thumbnail: 'https://example.com/thumb.jpg',
          operation: 'INSPECTED' as const,
          createdAt: new Date(2026, 7, 13, 11, 55).getTime()
        }
      ]
    })

    renderPage()
    await act(async () => {})

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/video')).toBeInTheDocument()
    expect(screen.getByText(/Inspected ·/)).toBeInTheDocument()
  })
})
