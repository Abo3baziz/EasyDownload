// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreloadApi } from '../../shared/types/preload'
import { HomePage } from './HomePage'

function createApiMock(): PreloadApi {
  return {
    inspectUrl: vi.fn(),
    startDownload: vi.fn(),
    cancelDownload: vi.fn(),
    retryDownload: vi.fn(),
    getDownload: vi.fn(),
    listDownloads: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    selectDirectory: vi.fn(),
    openFile: vi.fn(),
    openDirectory: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getDependencies: vi.fn(),
    onDownloadStateChange: vi.fn(() => () => undefined)
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  async function submitUrl(url: string) {
    render(<HomePage />)
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
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue({
      ok: true,
      data: {
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
      }
    })

    await submitUrl('https://www.youtube.com/watch?v=abc')

    expect(await screen.findByRole('heading', { name: 'Example Video' })).toBeInTheDocument()
    expect(screen.getByText('Example Channel · 02:05 · www.youtube.com')).toBeInTheDocument()
    expect(screen.getByText('360p MP4')).toBeInTheDocument()
    expect(screen.getByText('640x360')).toBeInTheDocument()
    expect(screen.getByText('1.5 KB')).toBeInTheDocument()
  })

  it('starts a download for the selected format in the configured directory', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue({
      ok: true,
      data: {
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
      }
    })
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

  it('shows an error when starting a download fails', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'abc',
        title: 'Example Video',
        website: 'www.youtube.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      }
    })
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
  })
})
