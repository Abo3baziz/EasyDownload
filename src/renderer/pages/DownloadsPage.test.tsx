// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversion } from '../../shared/types/conversion'
import type { PreloadApi } from '../../shared/types/preload'
import { DownloadsPage } from './DownloadsPage'

function createApiMock(): PreloadApi {
  return {
    inspectUrl: vi.fn(),
    startDownload: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    cancelDownload: vi.fn(),
    retryDownload: vi.fn(),
    getDownload: vi.fn(),
    listDownloads: vi.fn(),
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
    onConversionStateChange: vi.fn(() => () => undefined)
  }
}

function completedDownload() {
  return {
    id: 'dl-3',
    url: 'https://www.youtube.com/watch?v=abc',
    title: 'Finished Video',
    status: 'completed' as const,
    progress: { percent: 100 },
    fileName: 'video.mp4',
    fileSize: 100 * 1048576,
    destination: 'C:\\Downloads\\video.mp4',
    thumbnail: 'https://img.example.com/thumb.jpg',
    duration: 754,
    resolution: '1920x1080',
    extension: 'mp4',
    videoCodec: 'avc1.640028',
    audioCodec: 'mp4a.40.2',
    fps: 30,
    createdAt: Date.UTC(2026, 7, 12),
    updatedAt: Date.UTC(2026, 7, 12)
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

async function openSection(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
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

  it('shows section navigation cards with counts instead of items', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        completedDownload(),
        downloadingDownload(),
        { ...downloadingDownload(), id: 'dl-paused', status: 'paused' }
      ]
    })

    render(<DownloadsPage />)

    expect(await screen.findByRole('button', { name: /^Completed/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Queue/ })).toHaveTextContent('2 downloads')
    expect(screen.getByRole('button', { name: /^Cancelled/ })).toHaveTextContent('0 downloads')
    expect(screen.getByRole('button', { name: /^Failed/ })).toHaveTextContent('0 downloads')
    expect(screen.queryByText('Finished Video')).not.toBeInTheDocument()
    expect(screen.queryByText('Example Video')).not.toBeInTheDocument()
  })

  it('opens a dedicated section page and navigates back', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload(), downloadingDownload()]
    })

    render(<DownloadsPage />)

    await openSection('Completed')

    expect(await screen.findByRole('heading', { name: 'Completed' })).toBeInTheDocument()
    expect(screen.getByText('Finished Video')).toBeInTheDocument()
    expect(screen.queryByText('Example Video')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Downloads' }))

    expect(await screen.findByRole('button', { name: /^Completed/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Queue/ })).toBeInTheDocument()
  })

  it('shows an empty state on a dedicated section page with no items', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [downloadingDownload()]
    })

    render(<DownloadsPage />)

    await openSection('Failed')

    expect(await screen.findByText('No failed downloads.')).toBeInTheDocument()
  })

  it('updates section counts when a download status changes', async () => {
    const active = downloadingDownload()
    let listener: ((download: typeof active) => void) | undefined
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({ ok: true, data: [active] })
    window.mediaDownloader.onDownloadStateChange = vi.fn((callback) => {
      listener = callback as typeof listener
      return () => undefined
    })

    render(<DownloadsPage />)

    expect(await screen.findByRole('button', { name: /^Queue/ })).toHaveTextContent('1 download')
    expect(screen.getByRole('button', { name: /^Completed/ })).toHaveTextContent('0 downloads')

    act(() => listener?.({ ...active, status: 'completed' }))

    expect(await screen.findByRole('button', { name: /^Completed/ })).toHaveTextContent('1 download')
    expect(screen.getByRole('button', { name: /^Queue/ })).toHaveTextContent('0 downloads')
  })

  it('displays download progress and a cancel action for an active download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [downloadingDownload()] })

    render(<DownloadsPage />)
    await openSection('Queue')

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
    await openSection('Queue')

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(window.mediaDownloader.cancelDownload).toHaveBeenCalledWith('dl-1')
  })

  it('offers pause for an active download and resumes a paused download', async () => {
    const active = downloadingDownload()
    let listener: ((download: typeof active) => void) | undefined
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({ ok: true, data: [active] })
    window.mediaDownloader.onDownloadStateChange = vi.fn((callback) => {
      listener = callback as typeof listener
      return () => undefined
    })
    window.mediaDownloader.pauseDownload = vi.fn().mockResolvedValue({
      ok: true,
      data: { ...active, status: 'paused' }
    })
    window.mediaDownloader.resumeDownload = vi.fn().mockResolvedValue({
      ok: true,
      data: { ...active, status: 'downloading' }
    })

    render(<DownloadsPage />)
    await openSection('Queue')

    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(window.mediaDownloader.pauseDownload).toHaveBeenCalledWith('dl-1')

    act(() => listener?.({ ...active, status: 'paused' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))

    expect(window.mediaDownloader.resumeDownload).toHaveBeenCalledWith('dl-1')
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
    await openSection('Failed')

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
    await openSection('Completed')

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }))

    expect(window.mediaDownloader.openFile).toHaveBeenCalledWith('C:\\Downloads\\video.mp4')
  })

  it('opens the file location for a completed download', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'dl-3',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Finished Video',
          status: 'completed',
          progress: { percent: 100 },
          destination: 'C:\\Downloads\\video.mp4',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    window.mediaDownloader.openFileLocation = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined })

    render(<DownloadsPage />)
    await openSection('Completed')

    fireEvent.click(await screen.findByRole('button', { name: 'Open File Location' }))

    expect(window.mediaDownloader.openFileLocation).toHaveBeenCalledWith('C:\\Downloads\\video.mp4')
  })

  it('opens the file location for a converted audio item', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [completedDownload()] })
    window.mediaDownloader.listConversions = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'cv-1',
          type: 'extractAudio',
          input: 'C:\\Downloads\\video.mp4',
          output: 'C:\\Downloads\\video.mp3',
          status: 'completed',
          progress: { processedMs: 0 },
          title: 'Finished Video',
          createdAt: 2,
          updatedAt: 2
        }
      ]
    })
    window.mediaDownloader.openFileLocation = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined })

    render(<DownloadsPage />)
    await openSection('Completed')

    const buttons = await screen.findAllByRole('button', { name: 'Open File Location' })
    fireEvent.click(buttons[1]!)

    expect(window.mediaDownloader.openFileLocation).toHaveBeenCalledWith('C:\\Downloads\\video.mp3')
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
    await openSection('Completed')

    expect(await screen.findByText(/video\.mp4 · 100 MB/)).toBeInTheDocument()
  })

  it('shows the thumbnail and metadata for a completed download', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload()]
    })

    render(<DownloadsPage />)
    await openSection('Completed')

    const image = await screen.findByRole('img', { name: 'Finished Video' })
    expect(image).toHaveAttribute('src', 'https://img.example.com/thumb.jpg')
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('12:34')).toBeInTheDocument()
    expect(screen.getByText('Resolution')).toBeInTheDocument()
    expect(screen.getByText('1920x1080')).toBeInTheDocument()
    expect(screen.getByText('Format')).toBeInTheDocument()
    expect(screen.getByText('MP4')).toBeInTheDocument()
    expect(screen.getByText('Video codec')).toBeInTheDocument()
    expect(screen.getByText('avc1.640028')).toBeInTheDocument()
    expect(screen.getByText('Audio codec')).toBeInTheDocument()
    expect(screen.getByText('mp4a.40.2')).toBeInTheDocument()
    expect(screen.getByText('FPS')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('Downloaded')).toBeInTheDocument()
    expect(screen.getByText('2026-08-12')).toBeInTheDocument()
  })

  it('shows a fallback when a completed download has no thumbnail', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [{ ...completedDownload(), thumbnail: undefined }]
    })

    render(<DownloadsPage />)
    await openSection('Completed')

    expect(await screen.findByText('No thumbnail')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Finished Video')).toBeInTheDocument()
  })

  it('hides the thumbnail when it fails to load', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload()]
    })

    render(<DownloadsPage />)
    await openSection('Completed')

    const image = await screen.findByRole('img', { name: 'Finished Video' })
    fireEvent.error(image)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('No thumbnail')).toBeInTheDocument()
  })

  it('renders a completed download missing metadata and thumbnail', async () => {
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
          createdAt: Date.UTC(2026, 7, 12),
          updatedAt: Date.UTC(2026, 7, 12)
        }
      ]
    })

    render(<DownloadsPage />)
    await openSection('Completed')

    expect(await screen.findByText('Finished Video')).toBeInTheDocument()
    expect(screen.getByText(/video\.mp4 · 100 MB/)).toBeInTheDocument()
    expect(screen.getByText('No thumbnail')).toBeInTheDocument()
    expect(screen.getByText('Downloaded')).toBeInTheDocument()
    expect(screen.getByText('2026-08-12')).toBeInTheDocument()
    expect(screen.queryByText('Duration')).not.toBeInTheDocument()
    expect(screen.queryByText('Resolution')).not.toBeInTheDocument()
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
    window.mediaDownloader.clearHistory = vi.fn().mockResolvedValue({ ok: true, data: [] })

    render(<DownloadsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Clear history' }))

    expect(window.mediaDownloader.clearHistory).toHaveBeenCalled()
    expect(await screen.findByText(/No downloads yet/)).toBeInTheDocument()
  })

  it('starts a conversion from a completed download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [completedDownload()] })
    window.mediaDownloader.startConversion = vi
      .fn()
      .mockResolvedValue({ ok: true, data: {} })

    render(<DownloadsPage />)
    await openSection('Completed')

    fireEvent.click(await screen.findByRole('button', { name: 'Convert' }))

    expect(window.mediaDownloader.startConversion).toHaveBeenCalledWith({
      type: 'convert',
      videoCodec: 'h264',
      audioCodec: 'copy',
      input: 'C:\\Downloads\\video.mp4',
      title: 'Finished Video',
      thumbnail: 'https://img.example.com/thumb.jpg',
      duration: 754
    })
  })

  it('starts an audio extraction from a completed download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [completedDownload()] })
    window.mediaDownloader.startConversion = vi
      .fn()
      .mockResolvedValue({ ok: true, data: {} })

    render(<DownloadsPage />)
    await openSection('Completed')

    const select = await screen.findByLabelText('Conversion format')
    fireEvent.change(select, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    expect(window.mediaDownloader.startConversion).toHaveBeenCalledWith({
      type: 'extractAudio',
      audioCodec: 'mp3',
      input: 'C:\\Downloads\\video.mp4',
      title: 'Finished Video',
      thumbnail: 'https://img.example.com/thumb.jpg',
      duration: 754
    })
  })

  it('shows conversion progress and cancels it', async () => {
    let listener: ((conversion: Conversion) => void) | undefined
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [completedDownload()] })
    window.mediaDownloader.onConversionStateChange = vi.fn((cb) => {
      listener = cb
      return () => undefined
    })
    window.mediaDownloader.cancelConversion = vi
      .fn()
      .mockResolvedValue({ ok: true, data: {} })

    render(<DownloadsPage />)
    await openSection('Completed')

    await act(async () => {
      listener?.({
        id: 'cv-1',
        type: 'extractAudio',
        input: 'C:\\Downloads\\video.mp4',
        output: 'C:\\Downloads\\video.mp3',
        status: 'running',
        progress: { processedMs: 0 },
        createdAt: 2,
        updatedAt: 2
      })
    })

    expect(screen.getByText(/Converting…/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(window.mediaDownloader.cancelConversion).toHaveBeenCalledWith('cv-1')
  })

  it('shows the converted audio output and opens it', async () => {
    let listener: ((conversion: Conversion) => void) | undefined
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [completedDownload()] })
    window.mediaDownloader.onConversionStateChange = vi.fn((cb) => {
      listener = cb
      return () => undefined
    })
    window.mediaDownloader.openFile = vi.fn().mockResolvedValue({ ok: true, data: undefined })

    render(<DownloadsPage />)
    await openSection('Completed')

    await act(async () => {
      listener?.({
        id: 'cv-1',
        type: 'extractAudio',
        input: 'C:\\Downloads\\video.mp4',
        output: 'C:\\Downloads\\video.mp3',
        status: 'completed',
        progress: { processedMs: 0 },
        title: 'Finished Video',
        thumbnail: 'https://img.example.com/thumb.jpg',
        duration: 754,
        fileSize: 5 * 1048576,
        createdAt: 2,
        updatedAt: 2
      })
    })

    expect(screen.getByText('Converted audio')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Converted audio thumbnail' })).toHaveAttribute(
      'src',
      'https://img.example.com/thumb.jpg'
    )
    expect(screen.getByText('MP3')).toBeInTheDocument()
    expect(screen.getByText('5 MB')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open audio file' }))

    expect(window.mediaDownloader.openFile).toHaveBeenCalledWith('C:\\Downloads\\video.mp3')
  })

  it('restores persisted converted audio under its source download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [completedDownload()] })
    window.mediaDownloader.listConversions = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'cv-1',
          type: 'extractAudio',
          input: 'C:\\Downloads\\video.mp4',
          output: 'C:\\Downloads\\video.mp3',
          status: 'completed',
          progress: { processedMs: 0 },
          title: 'Finished Video',
          thumbnail: 'https://img.example.com/thumb.jpg',
          duration: 754,
          fileSize: 5 * 1048576,
          createdAt: Date.UTC(2026, 7, 12),
          updatedAt: Date.UTC(2026, 7, 12)
        }
      ]
    })
    window.mediaDownloader.openFile = vi.fn().mockResolvedValue({ ok: true, data: undefined })

    render(<DownloadsPage />)
    await openSection('Completed')

    expect(await screen.findByText('Converted audio')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Converted audio thumbnail' })).toHaveAttribute(
      'src',
      'https://img.example.com/thumb.jpg'
    )
    expect(screen.getByText('MP3')).toBeInTheDocument()
    expect(screen.getAllByText('2026-08-12').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('button', { name: 'Open audio file' }))

    expect(window.mediaDownloader.openFile).toHaveBeenCalledWith('C:\\Downloads\\video.mp3')
  })
})
