// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryEntry } from '../../shared/types/history'
import type { PreloadApi } from '../../shared/types/preload'
import { HistoryStateProvider } from '../state/historyState'
import { HomeStateProvider, useHomeState } from '../state/homeState'
import { HistorySection } from './HistorySection'

const NOW = new Date(2026, 7, 13, 12, 0, 0).getTime()

function createApiMock(): PreloadApi {
  return {
    inspectUrl: vi.fn(),
    startDownload: vi.fn(),
    downloadPlaylist: vi.fn(),
    cancelPlaylist: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    cancelDownload: vi.fn(),
    deleteDownload: vi.fn(),
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
    onDownloadDeleted: vi.fn(() => () => undefined),
    onConversionStateChange: vi.fn(() => () => undefined),
    listInspectionHistory: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    deleteInspectionHistoryEntry: vi.fn().mockResolvedValue({ ok: true, data: true }),
    onInspectionHistoryChange: vi.fn(() => () => undefined),
    onInspectionHistoryDeleted: vi.fn(() => () => undefined)
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

function HomeUrlProbe() {
  const { url } = useHomeState()
  return <span data-testid="home-url">{url}</span>
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

  async function renderSection(onInspect: (url: string) => void = vi.fn()) {
    render(
      <HomeStateProvider>
        <HistoryStateProvider>
          <HistorySection onInspect={onInspect} />
          <HomeUrlProbe />
        </HistoryStateProvider>
      </HomeStateProvider>
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

  it('replaces an existing entry and moves it to the top when the same URL is inspected again', async () => {
    let listener: ((item: HistoryEntry) => void) | undefined
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        entry({ id: 'a', url: 'https://example.com/a', createdAt: NOW - 60_000 }),
        entry({ id: 'b', url: 'https://example.com/b', createdAt: NOW - 3600_000 })
      ]
    })
    window.mediaDownloader.onInspectionHistoryChange = vi.fn((callback) => {
      listener = callback
      return () => undefined
    })

    await renderSection()

    act(() => {
      listener?.(entry({ id: 'a', url: 'https://example.com/a', createdAt: NOW + 1 }))
    })

    expect(screen.getAllByText('https://example.com/a')).toHaveLength(1)
    expect(screen.getByText('Inspected · Just now')).toBeInTheDocument()

    const urls = screen
      .getAllByTitle(/https:\/\/example\.com/)
      .map((node) => node.textContent)
    expect(urls).toEqual(['https://example.com/a', 'https://example.com/b'])
  })

  it('renders Inspect and Delete actions for every entry', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        entry({ id: 'one', url: 'https://example.com/one' }),
        entry({ id: 'two', url: 'https://example.com/two' })
      ]
    })

    await renderSection()

    expect(screen.getAllByRole('button', { name: /^Inspect / })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Inspect https://example.com/one' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete https://example.com/two' })
    ).toBeInTheDocument()
  })

  it('loads the entry URL into the Home inspection workflow when Inspect is clicked', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ url: 'https://example.com/video' })]
    })
    const onInspect = vi.fn()

    await renderSection(onInspect)

    fireEvent.click(screen.getByRole('button', { name: 'Inspect https://example.com/video' }))

    expect(screen.getByTestId('home-url')).toHaveTextContent('https://example.com/video')
    expect(onInspect).toHaveBeenCalledWith('https://example.com/video')
  })

  it('removes the entry and persists the deletion when Delete is clicked', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        entry({ id: 'keep', url: 'https://example.com/keep' }),
        entry({ id: 'gone', url: 'https://example.com/gone' })
      ]
    })

    await renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Delete https://example.com/gone' }))
    await act(async () => {})

    expect(window.mediaDownloader.deleteInspectionHistoryEntry).toHaveBeenCalledWith('gone')
    expect(screen.queryByText('https://example.com/gone')).toBeNull()
    expect(screen.getByText('https://example.com/keep')).toBeInTheDocument()
  })

  it('issues only one IPC delete for rapid double-clicks on Delete', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ id: 'gone', url: 'https://example.com/gone' })]
    })
    let resolveDelete: (() => void) | undefined
    window.mediaDownloader.deleteInspectionHistoryEntry = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = () => resolve({ ok: true, data: true })
          })
      )

    await renderSection()

    const button = screen.getByRole('button', { name: 'Delete https://example.com/gone' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(window.mediaDownloader.deleteInspectionHistoryEntry).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveDelete?.()
    })
  })

  it('restores the entry and shows an error when deletion fails', async () => {
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ id: 'sticky', url: 'https://example.com/sticky' })]
    })
    window.mediaDownloader.deleteInspectionHistoryEntry = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'FilesystemError', message: 'Failed to delete.' }
    })

    await renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Delete https://example.com/sticky' }))
    await act(async () => {})

    expect(screen.getByText('https://example.com/sticky')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete.')
  })

  it('removes an entry when a deletion event arrives from the main process', async () => {
    let listener: ((item: HistoryEntry) => void) | undefined
    window.mediaDownloader.listInspectionHistory = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry({ id: 'live', url: 'https://example.com/live' })]
    })
    window.mediaDownloader.onInspectionHistoryDeleted = vi.fn((callback) => {
      listener = callback
      return () => undefined
    })

    await renderSection()
    expect(screen.getByText('https://example.com/live')).toBeInTheDocument()

    act(() => {
      listener?.(entry({ id: 'live', url: 'https://example.com/live' }))
    })

    expect(screen.queryByText('https://example.com/live')).toBeNull()
  })
})
