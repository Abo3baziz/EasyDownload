// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaInfo } from '../../shared/types/media'
import type { PreloadApi } from '../../shared/types/preload'
import { HomeStateProvider } from '../state/homeState'
import { DownloadsStateProvider } from '../state/downloadState'
import { HomePage } from './HomePage'

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

function renderHome() {
  return render(
    <HomeStateProvider>
      <DownloadsStateProvider>
        <HomePage />
      </DownloadsStateProvider>
    </HomeStateProvider>
  )
}

function mediaFor(url: string): MediaInfo {
  return {
    id: 'id-' + url,
    title: 'Video for ' + url,
    website: 'www.example.com',
    formats: [
      {
        id: '18',
        label: '360p MP4',
        extension: 'mp4',
        resolution: '640x360',
        hasVideo: true,
        hasAudio: true
      }
    ]
  }
}

function inspectResult(media: MediaInfo) {
  return { ok: true, data: { kind: 'video' as const, media } }
}

function playlistResult(
  playlist: {
    id: string
    title: string
    thumbnail?: string
    website?: string
    entries: Array<{ id: string; title: string; url: string; duration?: number }>
  }
) {
  return {
    ok: true,
    data: { kind: 'playlist' as const, playlist }
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  async function submitUrl(url: string) {
    renderHome()
    await act(async () => {})
    fireEvent.change(screen.getByLabelText('Media URL'), { target: { value: url } })
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }))
  }

  it('shows an error alert when inspection fails', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'UnsupportedMediaError', message: 'Unsupported media.' }
    })

    await submitUrl('https://example.com/bad')

    expect(await screen.findByRole('alert')).toHaveTextContent('Unsupported media.')
  })

  it('displays media metadata and formats after a successful inspection', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 125,
        uploader: 'Example Channel',
        website: 'www.youtube.com',
        formats: [
          {
            id: '18',
            label: '360p MP4',
            extension: 'mp4',
            resolution: '640x360',
            videoCodec: 'avc1',
            audioCodec: 'mp4a',
            filesize: 1536,
            hasVideo: true,
            hasAudio: true
          }
        ]
      })
    )

    await submitUrl('https://www.youtube.com/watch?v=abc')

    expect(await screen.findByRole('heading', { name: 'Example Video' })).toBeInTheDocument()
    expect(screen.getByText('Example Channel · 02:05 · www.youtube.com')).toBeInTheDocument()
    expect(screen.getByText('360p MP4')).toBeInTheDocument()
    expect(screen.getByText('640x360')).toBeInTheDocument()
    expect(screen.getByText('1.5 KB')).toBeInTheDocument()
  })

  it('starts a download for the selected format in the configured directory', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          {
            id: '137',
            label: '1080p MP4',
            extension: 'mp4',
            resolution: '1920x1080',
            hasVideo: true,
            hasAudio: true
          }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.startDownload = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'dl-1',
        url: 'https://www.youtube.com/watch?v=abc',
        status: 'downloading',
        progress: {},
        createdAt: 1,
        updatedAt: 1
      }
    })

    await submitUrl('https://www.youtube.com/watch?v=abc')

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Download started')
    expect(window.mediaDownloader.startDownload).toHaveBeenCalledWith({
      url: 'https://www.youtube.com/watch?v=abc',
      formatId: '137',
      directory: 'C:\\Downloads'
    })
  })

  it('renders a playlist card with a quality preset selector', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      playlistResult({
        id: 'PL123',
        title: 'My Playlist',
        website: 'www.youtube.com',
        entries: [
          { id: 'v1', title: 'Video One', url: 'https://www.youtube.com/watch?v=v1', duration: 60 },
          { id: 'v2', title: 'Video Two', url: 'https://www.youtube.com/watch?v=v2' }
        ]
      })
    )

    await submitUrl('https://www.youtube.com/playlist?list=PL123')

    expect(await screen.findByRole('heading', { name: 'My Playlist' })).toBeInTheDocument()
    expect(screen.getByText('www.youtube.com · 2 videos')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Playlist quality' })).toBeInTheDocument()
    expect(screen.getByLabelText('720p')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download playlist' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Formats' })).not.toBeInTheDocument()
  })

  it('starts a playlist download with the selected preset in the configured directory', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      playlistResult({
        id: 'PL123',
        title: 'My Playlist',
        website: 'www.youtube.com',
        entries: [
          { id: 'v1', title: 'Video One', url: 'https://www.youtube.com/watch?v=v1' },
          { id: 'v2', title: 'Video Two', url: 'https://www.youtube.com/watch?v=v2' }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.downloadPlaylist = vi.fn().mockResolvedValue({
      ok: true,
      data: { playlistId: 'PL123', created: 2, skipped: 0 }
    })

    await submitUrl('https://www.youtube.com/playlist?list=PL123')

    fireEvent.click(await screen.findByLabelText('720p'))
    fireEvent.click(screen.getByRole('button', { name: 'Download playlist' }))

    expect(await screen.findByRole('status')).toHaveTextContent('2 videos queued')
    expect(window.mediaDownloader.downloadPlaylist).toHaveBeenCalledWith({
      url: 'https://www.youtube.com/playlist?list=PL123',
      preset: '720',
      directory: 'C:\\Downloads'
    })
  })

  it('reports skipped entries when starting a playlist download', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      playlistResult({
        id: 'PL123',
        title: 'My Playlist',
        website: 'www.youtube.com',
        entries: [
          { id: 'v1', title: 'Video One', url: 'https://www.youtube.com/watch?v=v1' }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.downloadPlaylist = vi.fn().mockResolvedValue({
      ok: true,
      data: { playlistId: 'PL123', created: 0, skipped: 1 }
    })

    await submitUrl('https://www.youtube.com/playlist?list=PL123')

    fireEvent.click(await screen.findByRole('button', { name: 'Download playlist' }))

    expect(await screen.findByRole('status')).toHaveTextContent('1 already downloaded and skipped')
  })

  it('shows live playlist progress after starting a playlist download', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      playlistResult({
        id: 'PL123',
        title: 'My Playlist',
        website: 'www.youtube.com',
        entries: [
          { id: 'v1', title: 'Video One', url: 'https://www.youtube.com/watch?v=v1' },
          { id: 'v2', title: 'Video Two', url: 'https://www.youtube.com/watch?v=v2' }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.downloadPlaylist = vi.fn().mockResolvedValue({
      ok: true,
      data: { playlistId: 'PL123', created: 2, skipped: 0 }
    })
    const entry = (id: string, status: string, percent?: number) => ({
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: id,
      status,
      progress: percent !== undefined ? { percent } : {},
      playlistId: 'PL123',
      playlistTitle: 'My Playlist',
      playlistIndex: 1,
      playlistCount: 2,
      createdAt: 1,
      updatedAt: 1
    })
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [entry('dl-1', 'downloading', 50), entry('dl-2', 'queued')]
    })

    await submitUrl('https://www.youtube.com/playlist?list=PL123')
    fireEvent.click(await screen.findByRole('button', { name: 'Download playlist' }))

    expect(await screen.findByText('0 of 2 videos · 25%')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download playlist' })).not.toBeInTheDocument()
  })

  it('shows an error when starting a playlist download fails', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      playlistResult({
        id: 'PL123',
        title: 'My Playlist',
        website: 'www.youtube.com',
        entries: [{ id: 'v1', title: 'Video One', url: 'https://www.youtube.com/watch?v=v1' }]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.downloadPlaylist = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'DownloadError', message: 'Playlist contains no videos.' }
    })

    await submitUrl('https://www.youtube.com/playlist?list=PL123')

    fireEvent.click(await screen.findByRole('button', { name: 'Download playlist' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Playlist contains no videos.')
  })

  it('shows the format button as disabled Downloading while the download is in progress', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.startDownload = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'dl-1',
        url: 'https://example.com/video-a',
        formatId: '18',
        status: 'queued',
        progress: {},
        createdAt: 1,
        updatedAt: 1
      }
    })

    await submitUrl('https://example.com/video-a')

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))

    expect(await screen.findByRole('button', { name: 'Downloading' })).toBeDisabled()
  })

  it('does not trigger duplicate download requests on rapid clicks', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.startDownload = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'dl-1',
        url: 'https://example.com/video-a',
        formatId: '18',
        status: 'queued',
        progress: {},
        createdAt: 1,
        updatedAt: 1
      }
    })

    await submitUrl('https://example.com/video-a')

    const button = await screen.findByRole('button', { name: 'Download' })
    fireEvent.click(button)
    fireEvent.click(button)

    await screen.findByRole('button', { name: 'Downloading' })
    expect(window.mediaDownloader.startDownload).toHaveBeenCalledTimes(1)
  })

  it('disables only the format whose download is in progress', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true },
          { id: '137', label: '1080p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.startDownload = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'dl-1',
        url: 'https://example.com/video-a',
        formatId: '18',
        status: 'queued',
        progress: {},
        createdAt: 1,
        updatedAt: 1
      }
    })

    await submitUrl('https://example.com/video-a')

    fireEvent.click((await screen.findAllByRole('button', { name: 'Download' }))[0])

    expect(screen.getByRole('button', { name: 'Downloading' })).toBeDisabled()
    const remaining = screen.getAllByRole('button', { name: 'Download' })
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toBeEnabled()
  })

  it('restores the Download button when the download completes', async () => {
    let listener: ((download: import('../../shared/types/download').Download) => void) | undefined
    window.mediaDownloader.onDownloadStateChange = vi.fn((callback) => {
      listener = callback
      return () => undefined
    })
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.startDownload = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'dl-1',
        url: 'https://example.com/video-a',
        formatId: '18',
        status: 'queued',
        progress: {},
        createdAt: 1,
        updatedAt: 1
      }
    })

    await submitUrl('https://example.com/video-a')

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))
    await screen.findByRole('button', { name: 'Downloading' })

    listener?.({
      id: 'dl-1',
      url: 'https://example.com/video-a',
      formatId: '18',
      status: 'completed',
      progress: {},
      createdAt: 1,
      updatedAt: 2
    })

    expect(await screen.findByRole('button', { name: 'Download' })).toBeEnabled()
  })

  it('shows an error when starting a download fails', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.startDownload = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'DependencyError', message: 'yt-dlp is not available.' }
    })

    await submitUrl('https://www.youtube.com/watch?v=abc')

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('yt-dlp is not available.')
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled()
  })

  it('notifies the user when the video was already downloaded in that format', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue(
      inspectResult({
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          { id: '137', label: '1080p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      })
    )
    window.mediaDownloader.getSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: 'C:\\Downloads', notificationsEnabled: true, concurrencyLimit: 1 }
    })
    window.mediaDownloader.startDownload = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: 'DownloadError',
        message: 'This video has already been downloaded in this format.'
      }
    })

    await submitUrl('https://www.youtube.com/watch?v=abc')

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This video has already been downloaded in this format.'
    )
    expect(window.mediaDownloader.startDownload).toHaveBeenCalledWith({
      url: 'https://www.youtube.com/watch?v=abc',
      formatId: '137',
      directory: 'C:\\Downloads'
    })
  })

  it('clears the URL input and the displayed inspection when Clear is clicked', async () => {
    window.mediaDownloader.inspectUrl = vi
      .fn()
      .mockResolvedValue(inspectResult(mediaFor('https://example.com/video-a')))

    await submitUrl('https://example.com/video-a')
    await screen.findByRole('heading', { name: 'Video for https://example.com/video-a' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.getByLabelText('Media URL')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Video for https://example.com/video-a' })).toBeNull()
  })

  it('restores the previous inspection when the same URL is entered again after Clear', async () => {
    window.mediaDownloader.inspectUrl = vi
      .fn()
      .mockResolvedValue(inspectResult(mediaFor('https://example.com/video-a')))

    await submitUrl('https://example.com/video-a')
    await screen.findByRole('heading', { name: 'Video for https://example.com/video-a' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.change(screen.getByLabelText('Media URL'), { target: { value: 'https://example.com/video-a' } })

    expect(await screen.findByRole('heading', { name: 'Video for https://example.com/video-a' })).toBeInTheDocument()
    expect(window.mediaDownloader.inspectUrl).toHaveBeenCalledTimes(1)
  })

  it('does not display a stale inspection when a different URL is entered', async () => {
    window.mediaDownloader.inspectUrl = vi
      .fn()
      .mockResolvedValue(inspectResult(mediaFor('https://example.com/video-a')))

    await submitUrl('https://example.com/video-a')
    await screen.findByRole('heading', { name: 'Video for https://example.com/video-a' })

    fireEvent.change(screen.getByLabelText('Media URL'), {
      target: { value: 'https://example.com/video-b' }
    })

    expect(screen.queryByRole('heading', { name: 'Video for https://example.com/video-a' })).toBeNull()
  })

  it('switches between two previously inspected URLs', async () => {
    window.mediaDownloader.inspectUrl = vi
      .fn()
      .mockResolvedValueOnce(inspectResult(mediaFor('https://example.com/video-a')))
      .mockResolvedValueOnce(inspectResult(mediaFor('https://example.com/video-b')))

    renderHome()
    await act(async () => {})
    const input = screen.getByLabelText('Media URL')

    fireEvent.change(input, { target: { value: 'https://example.com/video-a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await screen.findByRole('heading', { name: 'Video for https://example.com/video-a' })

    fireEvent.change(input, { target: { value: 'https://example.com/video-b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await screen.findByRole('heading', { name: 'Video for https://example.com/video-b' })

    fireEvent.change(input, { target: { value: 'https://example.com/video-a' } })
    expect(await screen.findByRole('heading', { name: 'Video for https://example.com/video-a' })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'https://example.com/video-b' } })
    expect(await screen.findByRole('heading', { name: 'Video for https://example.com/video-b' })).toBeInTheDocument()
    expect(window.mediaDownloader.inspectUrl).toHaveBeenCalledTimes(2)
  })
})
