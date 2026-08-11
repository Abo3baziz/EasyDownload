// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreloadApi } from '../../shared/types/preload'
import { DownloadsPage } from './DownloadsPage'

function createApiMock(): PreloadApi {
  return {
    inspectUrl: vi.fn(),
    startDownload: vi.fn(),
    cancelDownload: vi.fn(),
    retryDownload: vi.fn(),
    getDownload: vi.fn(),
    listDownloads: vi.fn(),
    clearHistory: vi.fn(),
    selectDirectory: vi.fn(),
    openFile: vi.fn(),
    openDirectory: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getDependencies: vi.fn(),
    onDownloadStateChange: vi.fn(() => () => undefined)
  }
}

function downloadingDownload() {
  return {
    id: 'dl-1',
    url: 'https://www.youtube.com/watch?v=abc',
    title: 'Example Video',
    status: 'downloading',
    progress: {
      percent: 42,
      downloadedBytes: 42 * 1048576,
      totalBytes: 100 * 1048576,
      speedBytesPerSecond: 1048576,
      etaSeconds: 58
    },
    createdAt: 1,
    updatedAt: 1
  }
}

describe('DownloadsPage', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  it('shows the empty state when there are no downloads', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [] })

    render(<DownloadsPage />)

    expect(await screen.findByText(/No downloads yet/)).toBeInTheDocument()
  })

  it('displays download progress and a cancel action for an active download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [downloadingDownload()] })

    render(<DownloadsPage />)

    expect(await screen.findByText('Example Video')).toBeInTheDocument()
    expect(await screen.findByText(/42%/)).toBeInTheDocument()
    expect(screen.getByText(/42 MB \/ 100 MB/)).toBeInTheDocument()
    expect(screen.getByText(/1 MB\/s/)).toBeInTheDocument()
    expect(screen.getByText(/ETA 00:58/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('cancels a download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [downloadingDownload()] })
    window.mediaDownloader.cancelDownload = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { ...downloadingDownload(), status: 'cancelled' } })

    render(<DownloadsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(window.mediaDownloader.cancelDownload).toHaveBeenCalledWith('dl-1')
  })

  it('offers retry for a failed download', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'dl-2',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Broken Video',
          status: 'failed',
          progress: {},
          error: { code: 'NetworkError', message: 'The network request failed.' },
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    window.mediaDownloader.retryDownload = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { ...downloadingDownload(), id: 'dl-2' } })

    render(<DownloadsPage />)

    expect(await screen.findByText('Broken Video')).toBeInTheDocument()
    expect(screen.getByText(/NetworkError: The network request failed/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(window.mediaDownloader.retryDownload).toHaveBeenCalledWith('dl-2')
  })

  it('offers opening the file for a completed download', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'dl-3',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Finished Video',
          status: 'completed',
          progress: { percent: 100 },
          fileName: 'video.mp4',
          destination: 'C:\\Downloads\\video.mp4',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    window.mediaDownloader.openFile = vi.fn().mockResolvedValue({ ok: true, data: undefined })

    render(<DownloadsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }))

    expect(window.mediaDownloader.openFile).toHaveBeenCalledWith('C:\\Downloads\\video.mp4')
  })

  it('shows the file name and size for a completed download', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'dl-3',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Finished Video',
          status: 'completed',
          progress: { percent: 100 },
          fileName: 'video.mp4',
          fileSize: 100 * 1048576,
          destination: 'C:\\Downloads\\video.mp4',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })

    render(<DownloadsPage />)

    expect(await screen.findByText(/video\.mp4 · 100 MB/)).toBeInTheDocument()
  })

  it('clears the history and updates the list', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'dl-1',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Finished Video',
          status: 'completed',
          progress: { percent: 100 },
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    window.mediaDownloader.clearHistory = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [] })

    render(<DownloadsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Clear history' }))

    expect(window.mediaDownloader.clearHistory).toHaveBeenCalled()
    expect(await screen.findByText(/No downloads yet/)).toBeInTheDocument()
  })
})
