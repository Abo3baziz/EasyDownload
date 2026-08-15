// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Download } from '../../shared/types/download'
import type { PreloadApi } from '../../shared/types/preload'
import { Sidebar } from './Sidebar'

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

function activeDownload() {
  return {
    id: 'dl-1',
    url: 'https://www.youtube.com/watch?v=abc',
    title: 'Example Video',
    status: 'downloading' as const,
    progress: { percent: 10 },
    createdAt: 1,
    updatedAt: 1
  }
}

describe('Sidebar', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  it('renders all sections with the download group expanded', () => {
    render(<Sidebar section="home" onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download Sections' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Downloads' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Queue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Failed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('collapses and expands the download sections group', () => {
    render(<Sidebar section="home" onNavigate={vi.fn()} />)

    const group = screen.getByRole('button', { name: 'Download Sections' })
    fireEvent.click(group)
    expect(group).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(group)
    expect(group).toHaveAttribute('aria-expanded', 'true')
  })

  it('navigates when a section is selected', () => {
    const onNavigate = vi.fn()
    render(<Sidebar section="home" onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }))
    expect(onNavigate).toHaveBeenCalledWith('queue')

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(onNavigate).toHaveBeenCalledWith('history')
  })

  it('highlights the active section', () => {
    render(<Sidebar section="queue" onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Queue' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('shows live count badges for download sections', async () => {
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({
      ok: true,
      data: [
        { ...activeDownload(), id: 'dl-1' },
        { ...activeDownload(), id: 'dl-2', status: 'paused' },
        {
          ...activeDownload(),
          id: 'dl-3',
          status: 'completed',
          progress: { percent: 100 }
        }
      ]
    })

    render(<Sidebar section="home" onNavigate={vi.fn()} />)

    const queue = await screen.findByRole('button', { name: 'Queue' })
    expect(within(queue).getByText('2')).toBeInTheDocument()

    const completed = screen.getByRole('button', { name: 'Completed' })
    expect(within(completed).getByText('1')).toBeInTheDocument()

    expect(within(screen.getByRole('button', { name: 'Cancelled' })).queryByText('0')).not.toBeInTheDocument()
  })

  it('updates count badges when a download status changes', async () => {
    const active = activeDownload()
    let listener: ((download: Download) => void) | undefined
    window.mediaDownloader.listDownloads = vi.fn().mockResolvedValue({ ok: true, data: [active] })
    window.mediaDownloader.onDownloadStateChange = vi.fn((callback) => {
      listener = callback as typeof listener
      return () => undefined
    })

    render(<Sidebar section="home" onNavigate={vi.fn()} />)

    const queue = await screen.findByRole('button', { name: 'Queue' })
    expect(within(queue).getByText('1')).toBeInTheDocument()

    act(() => listener?.({ ...active, status: 'completed' }))

    expect(within(await screen.findByRole('button', { name: 'Completed' })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: 'Queue' })).queryByText('1')).not.toBeInTheDocument()
  })

  it('collapses to an icon-only rail and keeps the group distinguishable', () => {
    const { container } = render(<Sidebar section="queue" onNavigate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }))

    expect(screen.getByRole('navigation')).toHaveClass('collapsed')
    expect(container.querySelector('.app-sidebar.collapsed .sidebar-chevron')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }))
    expect(screen.getByRole('navigation')).not.toHaveClass('collapsed')
  })

  it('keeps group expansion state when collapsing the sidebar', () => {
    render(<Sidebar section="queue" onNavigate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(screen.getByRole('button', { name: 'Download Sections' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }))
    expect(screen.getByRole('button', { name: 'Queue' })).toBeInTheDocument()
  })
})
