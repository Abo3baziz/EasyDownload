// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Download } from '../../shared/types/download'
import type { PreloadApi } from '../../shared/types/preload'
import { DownloadsStateProvider, useDownloadsData, useDownloadMeta } from './downloadState'

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
    downloadPlaylist: vi.fn(),
    cancelPlaylist: vi.fn(),
    listConversions: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    onDownloadStateChange: vi.fn(() => () => undefined),
    onDownloadDeleted: vi.fn(() => () => undefined),
    onConversionStateChange: vi.fn(() => () => undefined),
    listInspectionHistory: vi.fn(),
    deleteInspectionHistoryEntry: vi.fn(),
    onInspectionHistoryChange: vi.fn(() => () => undefined),
    onInspectionHistoryDeleted: vi.fn(() => () => undefined)
  }
}

function download(overrides: Partial<Download> = {}): Download {
  return {
    id: 'dl-1',
    url: 'https://www.youtube.com/watch?v=abc',
    title: 'Example Video',
    status: 'downloading',
    progress: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

let emitState: ((download: Download) => void) | undefined
let emitDelete: ((download: Download) => void) | undefined

function Probe() {
  const { downloads } = useDownloadsData()
  const { error, loaded } = useDownloadMeta()
  return (
    <ul>
      <li data-testid="loaded">{String(loaded)}</li>
      <li data-testid="error">{error ? error.code : 'none'}</li>
      {downloads.map((item) => (
        <li key={item.id} data-testid="download">
          {item.id}:{item.status}:{item.progress.percent ?? '-'}
        </li>
      ))}
    </ul>
  )
}

async function renderProbe(api: PreloadApi) {
  window.mediaDownloader = api
  render(
    <DownloadsStateProvider>
      <Probe />
    </DownloadsStateProvider>
  )
  await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('true'))
}

describe('DownloadsStateProvider', () => {
  beforeEach(() => {
    emitState = undefined
    emitDelete = undefined
  })

  it('applies live events that arrive before the initial snapshot on top of it', async () => {
    const api = createApiMock()
    let snapshotResolver: (() => void) | undefined
    api.listDownloads = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          snapshotResolver = () => resolve({ ok: true, data: [download()] })
        })
    )
    api.onDownloadStateChange = vi.fn((listener) => {
      emitState = listener
      return () => undefined
    })

    window.mediaDownloader = api
    render(
      <DownloadsStateProvider>
        <Probe />
      </DownloadsStateProvider>
    )
    expect(screen.queryAllByTestId('download')).toHaveLength(0)

    act(() => emitState?.(download({ progress: { percent: 42 } })))
    expect(screen.getAllByTestId('download')).toHaveLength(1)
    expect(screen.getByTestId('download')).toHaveTextContent('dl-1:downloading:42')

    act(() => snapshotResolver?.())
    await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('true'))
    expect(screen.getByTestId('download')).toHaveTextContent('dl-1:downloading:42')
  })

  it('revives a tombstoned id when a later state event arrives', async () => {
    const api = createApiMock()
    api.listDownloads = vi.fn().mockResolvedValue({ ok: true, data: [] })
    api.onDownloadStateChange = vi.fn((listener) => {
      emitState = listener
      return () => undefined
    })
    api.onDownloadDeleted = vi.fn((listener) => {
      emitDelete = listener
      return () => undefined
    })

    await renderProbe(api)

    act(() => {
      emitState?.(download({ status: 'completed', progress: { percent: 100 } }))
    })
    act(() => emitDelete?.(download({ status: 'completed' })))
    expect(screen.queryByTestId('download')).not.toBeInTheDocument()

    act(() => {
      emitState?.(download({ status: 'queued', progress: {} }))
    })
    expect(screen.getByTestId('download')).toHaveTextContent('dl-1:queued:-')
  })

  it('does not resurrect a deleted entry when the snapshot still contains it', async () => {
    const api = createApiMock()
    let snapshotResolver: (() => void) | undefined
    api.listDownloads = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          snapshotResolver = () => resolve({ ok: true, data: [download({ status: 'completed' })] })
        })
    )
    api.onDownloadDeleted = vi.fn((listener) => {
      emitDelete = listener
      return () => undefined
    })

    window.mediaDownloader = api
    render(
      <DownloadsStateProvider>
        <Probe />
      </DownloadsStateProvider>
    )

    act(() => emitDelete?.(download()))
    act(() => snapshotResolver?.())
    await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('true'))

    expect(screen.queryByTestId('download')).not.toBeInTheDocument()
  })

  it('surfaces load errors from the meta context', async () => {
    const api = createApiMock()
    api.listDownloads = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { code: 'FilesystemError', message: 'boom' } })

    await renderProbe(api)

    expect(screen.getByTestId('error')).toHaveTextContent('FilesystemError')
  })
})
