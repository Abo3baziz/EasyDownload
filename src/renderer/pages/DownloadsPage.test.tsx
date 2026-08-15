// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversion } from '../../shared/types/conversion'
import type { Download } from '../../shared/types/download'
import type { PreloadApi } from '../../shared/types/preload'
import { DownloadsPage, type DownloadSection } from './DownloadsPage'

function createApiMock(): PreloadApi {
  return {
    inspectUrl: vi.fn(),
    startDownload: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    cancelDownload: vi.fn(),
    deleteDownload: vi.fn(),
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
    onDownloadDeleted: vi.fn(() => () => undefined),
    onConversionStateChange: vi.fn(() => () => undefined),
    listInspectionHistory: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    deleteInspectionHistoryEntry: vi.fn().mockResolvedValue({ ok: true, data: true }),
    onInspectionHistoryChange: vi.fn(() => () => undefined),
    onInspectionHistoryDeleted: vi.fn(() => () => undefined)
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

function downloadOnDay(
  id: string,
  title: string,
  status: Download['status'],
  daysAgo: number
): Download {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  const timestamp = date.getTime()
  return {
    id,
    url: `https://example.com/${id}`,
    title,
    status,
    progress: {},
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

const groupedSectionCases: Array<{
  section: DownloadSection
  statuses: [Download['status'], Download['status']]
}> = [
  { section: 'downloads', statuses: ['downloading', 'completed'] },
  { section: 'completed', statuses: ['completed', 'completed'] },
  { section: 'cancelled', statuses: ['cancelled', 'cancelled'] },
  { section: 'failed', statuses: ['failed', 'failed'] }
]

function renderSection(section: DownloadSection) {
  return render(<DownloadsPage section={section} />)
}

describe('DownloadsPage', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  it('shows the empty state when there are no downloads', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [] })

    renderSection('downloads')

    expect(await screen.findByText(/No downloads yet/)).toBeInTheDocument()
  })

  it('lists every download on the Downloads section', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload(), downloadingDownload()]
    })

    renderSection('downloads')

    expect(await screen.findByText('Finished Video')).toBeInTheDocument()
    expect(screen.getByText('Example Video')).toBeInTheDocument()
  })

  it('lists only completed downloads on the Completed section', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload(), downloadingDownload()]
    })

    renderSection('completed')

    expect(await screen.findByText('Finished Video')).toBeInTheDocument()
    expect(screen.queryByText('Example Video')).not.toBeInTheDocument()
  })

  it('lists only active downloads on the Queue section', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload(), downloadingDownload()]
    })

    renderSection('queue')

    expect(await screen.findByText('Example Video')).toBeInTheDocument()
    expect(screen.queryByText('Finished Video')).not.toBeInTheDocument()
  })

  it.each(groupedSectionCases)(
    'groups $section downloads by local day',
    async ({ section, statuses }) => {
      window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
        ok: true,
        data: [
          downloadOnDay(`${section}-today`, 'Today Video', statuses[0], 0),
          downloadOnDay(`${section}-yesterday`, 'Yesterday Video', statuses[1], 1)
        ]
      })

      renderSection(section)

      expect(await screen.findByRole('heading', { name: 'Today', level: 3 })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Yesterday', level: 3 })).toBeInTheDocument()
      expect(screen.getByText('Today Video')).toBeInTheDocument()
      expect(screen.getByText('Yesterday Video')).toBeInTheDocument()
    }
  )

  it('shows an empty state on a dedicated section page with no items', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [downloadingDownload()]
    })

    renderSection('failed')

    expect(await screen.findByText('No failed downloads.')).toBeInTheDocument()
  })

  it('removes a download from the section list when its status changes', async () => {
    const active = downloadingDownload()
    let listener: ((download: typeof active) => void) | undefined
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({ ok: true, data: [active] })
    window.mediaDownloader.onDownloadStateChange = vi.fn((callback) => {
      listener = callback as typeof listener
      return () => undefined
    })

    renderSection('queue')

    expect(await screen.findByText('Example Video')).toBeInTheDocument()

    act(() => listener?.({ ...active, status: 'completed' }))

    expect(await screen.findByText('No downloads in the queue.')).toBeInTheDocument()
  })

  it('displays download progress and a cancel action for an active download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [downloadingDownload()] })

    renderSection('queue')

    expect(await screen.findByText('Example Video')).toBeInTheDocument()
    expect(await screen.findByText(/42%/)).toBeInTheDocument()
    expect(screen.getByText(/42 MB \/ 100 MB/)).toBeInTheDocument()
    expect(screen.getByText(/1 MB\/s/)).toBeInTheDocument()
    expect(screen.getByText(/ETA 00:58/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it.each(['completed', 'cancelled', 'failed'] as const)(
    'offers Delete for %s downloads',
    async (status) => {
      const download: Download =
        status === 'completed'
          ? completedDownload()
          : {
              ...downloadingDownload(),
              id: `dl-${status}`,
              title: `${status} Video`,
              status,
              progress: {},
              error:
                status === 'failed'
                  ? { code: 'NetworkError', message: 'The network request failed.' }
                  : undefined
            }
      window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
        ok: true,
        data: [download]
      })
      window.mediaDownloader.deleteDownload = vi
        .fn()
        .mockResolvedValue({ ok: true, data: true })

      renderSection(status === 'completed' ? 'completed' : status)

      fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
      await act(async () => {})

      expect(window.mediaDownloader.deleteDownload).toHaveBeenCalledWith(download.id)
    }
  )

  it('removes a download when a deletion event arrives', async () => {
    const completed = completedDownload()
    let listener: ((download: Download) => void) | undefined
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completed]
    })
    window.mediaDownloader.onDownloadDeleted = vi.fn((callback) => {
      listener = callback
      return () => undefined
    })

    renderSection('completed')

    expect(await screen.findByText('Finished Video')).toBeInTheDocument()
    act(() => listener?.(completed))

    expect(await screen.findByText('No completed downloads.')).toBeInTheDocument()
  })

  it('shows an error when deleting a download fails', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload()]
    })
    window.mediaDownloader.deleteDownload = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'FilesystemError', message: 'Failed to delete history entry.' }
    })

    renderSection('completed')

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await act(async () => {})

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete history entry.')
    expect(screen.getByText('Finished Video')).toBeInTheDocument()
  })

  it('renders two same-video downloads with different formats as independent items', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'dl-1080p',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Example Video',
          status: 'downloading',
          formatId: '137',
          progress: { percent: 45 },
          createdAt: 1,
          updatedAt: 1
        },
        {
          id: 'dl-720p',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Example Video',
          status: 'downloading',
          formatId: '18',
          progress: { percent: 20 },
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })

    renderSection('queue')

    expect(await screen.findAllByText('Example Video')).toHaveLength(2)
    expect(screen.getByText(/45%/)).toBeInTheDocument()
    expect(screen.getByText(/20%/)).toBeInTheDocument()
  })

  it('cancels a download', async () => {
    window.mediaDownloader.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: true, data: [downloadingDownload()] })
    window.mediaDownloader.cancelDownload = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { ...downloadingDownload(), status: 'cancelled' } })

    renderSection('queue')

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

    renderSection('queue')

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

    renderSection('failed')

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

    renderSection('completed')

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

    renderSection('completed')

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

    renderSection('completed')

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

    renderSection('completed')

    expect(await screen.findByText(/video\.mp4 · 100 MB/)).toBeInTheDocument()
  })

  it('shows the thumbnail and metadata for a completed download', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload()]
    })

    renderSection('completed')

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

    renderSection('completed')

    expect(await screen.findByText('No thumbnail')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Finished Video')).toBeInTheDocument()
  })

  it('hides the thumbnail when it fails to load', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [completedDownload()]
    })

    renderSection('completed')

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

    renderSection('completed')

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

    renderSection('downloads')

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

    renderSection('completed')

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

    renderSection('completed')

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

    renderSection('completed')

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

    renderSection('completed')

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

    renderSection('completed')

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
