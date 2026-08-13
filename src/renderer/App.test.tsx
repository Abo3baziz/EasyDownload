// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { PreloadApi } from '../shared/types/preload'

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
    getSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: '', notificationsEnabled: true, concurrencyLimit: 1 }
    }),
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

describe('App', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  async function renderApp() {
    render(<App />)
    await act(async () => {})
  }

  it('renders the navigation and the home page', async () => {
    await renderApp()

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Downloads' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByLabelText('Media URL')).toBeInTheDocument()
  })

  it('navigates to the settings page', async () => {
    await renderApp()

    await screen.getByRole('button', { name: 'Settings' }).click()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('keeps the URL and inspection result when navigating Home → Downloads → Home', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'abc',
        title: 'Example Video',
        website: 'www.example.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      }
    })

    await renderApp()

    fireEvent.change(screen.getByLabelText('Media URL'), {
      target: { value: 'https://example.com/video-a' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await screen.findByRole('heading', { name: 'Example Video' })

    fireEvent.click(screen.getByRole('button', { name: 'Downloads' }))
    expect(screen.getByRole('heading', { name: 'Downloads' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.getByLabelText('Media URL')).toHaveValue('https://example.com/video-a')
    expect(screen.getByRole('heading', { name: 'Example Video' })).toBeInTheDocument()
    expect(screen.getByText('360p MP4')).toBeInTheDocument()
  })

  it('keeps the URL and inspection result when navigating Home → Settings → Home', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'abc',
        title: 'Example Video',
        website: 'www.example.com',
        formats: [
          { id: '18', label: '360p MP4', extension: 'mp4', hasVideo: true, hasAudio: true }
        ]
      }
    })

    await renderApp()

    fireEvent.change(screen.getByLabelText('Media URL'), {
      target: { value: 'https://example.com/video-a' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await screen.findByRole('heading', { name: 'Example Video' })

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.getByLabelText('Media URL')).toHaveValue('https://example.com/video-a')
    expect(screen.getByRole('heading', { name: 'Example Video' })).toBeInTheDocument()
    expect(screen.getByText('360p MP4')).toBeInTheDocument()
  })

  it('keeps the format button in Downloading state when navigating away and back', async () => {
    window.mediaDownloader.inspectUrl = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'abc',
        title: 'Example Video',
        website: 'www.example.com',
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

    await renderApp()

    fireEvent.change(screen.getByLabelText('Media URL'), {
      target: { value: 'https://example.com/video-a' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await screen.findByRole('heading', { name: 'Example Video' })

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))
    await screen.findByRole('button', { name: 'Downloading' })

    fireEvent.click(screen.getByRole('button', { name: 'Downloads' }))
    expect(screen.getByRole('heading', { name: 'Downloads' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.getByRole('button', { name: 'Downloading' })).toBeDisabled()
  })
})
