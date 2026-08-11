// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { PreloadApi } from '../shared/types/preload'

function createApiMock(): PreloadApi {
  return {
    inspectUrl: vi.fn(),
    startDownload: vi.fn(),
    cancelDownload: vi.fn(),
    retryDownload: vi.fn(),
    getDownload: vi.fn(),
    listDownloads: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    clearHistory: vi.fn(),
    selectDirectory: vi.fn(),
    openFile: vi.fn(),
    openDirectory: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: { downloadDirectory: '', notificationsEnabled: true, concurrencyLimit: 1 }
    }),
    updateSettings: vi.fn(),
    getDependencies: vi.fn(),
    startConversion: vi.fn(),
    cancelConversion: vi.fn(),
    onDownloadStateChange: vi.fn(() => () => undefined),
    onConversionStateChange: vi.fn(() => () => undefined)
  }
}

describe('App', () => {
  beforeEach(() => {
    window.mediaDownloader = createApiMock()
  })

  it('renders the navigation and the home page', () => {
    render(<App />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Downloads' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByLabelText('Media URL')).toBeInTheDocument()
  })

  it('navigates to the settings page', async () => {
    render(<App />)

    await screen.getByRole('button', { name: 'Settings' }).click()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })
})
