// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaInfo } from '../../shared/types/media'
import type { PreloadApi } from '../../shared/types/preload'
import { HomeStateProvider } from '../state/homeState'
import { HomePage } from './HomePage'

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
    deleteInspectionHistoryEntry: vi.fn().mockResolvedValue({ ok: true, data: true }),
    onInspectionHistoryChange: vi.fn(() => () => undefined),
    onInspectionHistoryDeleted: vi.fn(() => () => undefined)
  }
}

function renderHome() {
  return render(
    <HomeStateProvider>
      <HomePage />
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
  return { ok: true, data: media }
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
