// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../../shared/types/settings'
import type { PreloadApi } from '../../shared/types/preload'
import { SettingsPage } from './SettingsPage'

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
    getSettings: vi.fn().mockResolvedValue({ ok: true, data: defaultSettings() }),
    updateSettings: vi.fn(),
    getDependencies: vi.fn(),
    startConversion: vi.fn(),
    cancelConversion: vi.fn(),
    listConversions: vi.fn(),
    onDownloadStateChange: vi.fn(() => () => undefined),
    onDownloadDeleted: vi.fn(() => () => undefined),
    onConversionStateChange: vi.fn(() => () => undefined),
    listInspectionHistory: vi.fn(),
    deleteInspectionHistoryEntry: vi.fn(),
    onInspectionHistoryChange: vi.fn(() => () => undefined),
    onInspectionHistoryDeleted: vi.fn(() => () => undefined)
  }
}

function defaultSettings(): AppSettings {
  return {
    downloadDirectory: 'C:\\Downloads',
    notificationsEnabled: true,
    concurrencyLimit: 2
  }
}

describe('SettingsPage', () => {
  let api: PreloadApi

  beforeEach(() => {
    api = createApiMock()
    window.mediaDownloader = api
  })

  it('renders the settings form after loading', async () => {
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Download directory')).toHaveValue('C:\\Downloads')
    })
  })

  it('shows a full-page error when loading settings fails', async () => {
    api.getSettings = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'FilesystemError', message: 'Failed to read settings.' }
    })
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('FilesystemError')
    })
    expect(screen.queryByText('Save settings')).not.toBeInTheDocument()
  })

  it('keeps the form visible with an inline alert when saving fails', async () => {
    api.updateSettings = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { code: 'FilesystemError', message: 'Disk full' } })
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Download directory')).toHaveValue('C:\\Downloads')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('FilesystemError')
    })
    expect(screen.getByLabelText('Download directory')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable desktop notifications')).toBeInTheDocument()
  })
})
