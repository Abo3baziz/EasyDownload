// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
    onConversionStateChange: vi.fn(() => () => undefined)
  }
}

describe('App', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  it('renders the sidebar navigation and the home page', () => {
    render(<App />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download Sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Downloads' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Queue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Failed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByLabelText('Media URL')).toBeInTheDocument()
  })

  it('navigates to the settings page', async () => {
    render(<App />)

    await screen.getByRole('button', { name: 'Settings' }).click()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('navigates to the history placeholder page', async () => {
    render(<App />)

    await screen.getByRole('button', { name: 'History' }).click()

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
  })

  it('navigates to each download section', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Downloads' }))
    expect(screen.getByRole('heading', { name: 'Downloads' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }))
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }))
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }))
    expect(screen.getByRole('heading', { name: 'Cancelled' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Failed' }))
    expect(screen.getByRole('heading', { name: 'Failed' })).toBeInTheDocument()
  })

  it('expands and collapses the Download Sections group', () => {
    render(<App />)

    const group = screen.getByRole('button', { name: 'Download Sections' })
    expect(group).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(group)
    expect(group).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(group)
    expect(group).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps the active download section and the current page when the group is collapsed', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }))
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Download Sections' }))
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Download Sections' }))
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()
  })

  it('collapses and expands the sidebar with the show/hide button', () => {
    render(<App />)

    expect(screen.getByRole('navigation')).not.toHaveClass('collapsed')

    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(screen.getByRole('navigation')).toHaveClass('collapsed')
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }))
    expect(screen.getByRole('navigation')).not.toHaveClass('collapsed')
  })

  it('keeps the current page when the sidebar is collapsed', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }))
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()
  })

  it('highlights the active section', async () => {
    render(<App />)

    await screen.getByRole('button', { name: 'Settings' }).click()

    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
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

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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
