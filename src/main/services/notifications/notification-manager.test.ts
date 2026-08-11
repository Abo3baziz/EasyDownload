import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Download } from '../../../shared/types/download'
import type { AppSettings } from '../../../shared/types/settings'
import { createNotificationManager } from './notification-manager'

const SETTINGS: AppSettings = {
  downloadDirectory: 'C:\\Downloads',
  notificationsEnabled: true,
  concurrencyLimit: 1
}

function download(overrides: Partial<Download> = {}): Download {
  return {
    id: 'dl-1',
    url: 'https://example.com/watch?v=1',
    status: 'completed',
    progress: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function setup(options: {
  isSupported?: boolean
  getSettings?: Mock<() => Promise<AppSettings>>
  show?: Mock<(title: string, body: string) => void>
}) {
  const show = options.show ?? vi.fn()
  const getSettings = options.getSettings ?? vi.fn().mockResolvedValue(SETTINGS)
  const manager = createNotificationManager({
    isSupported: () => options.isSupported ?? true,
    getSettings,
    show
  })
  return { manager, show, getSettings }
}

describe('createNotificationManager', () => {
  it('shows a notification when a download completes', async () => {
    const { manager, show } = setup({})
    await manager.notify(download({ title: 'Example Video' }))

    expect(show).toHaveBeenCalledWith('Download complete', 'Example Video')
  })

  it('falls back to the file name or URL as the notification body', async () => {
    const { manager, show } = setup({})
    await manager.notify(download({ fileName: 'Example Video.mp4' }))

    expect(show).toHaveBeenCalledWith('Download complete', 'Example Video.mp4')

    show.mockClear()
    await manager.notify(download({ title: undefined, fileName: undefined }))
    expect(show).toHaveBeenCalledWith('Download complete', 'https://example.com/watch?v=1')
  })

  it('shows a notification with the error message when a download fails', async () => {
    const { manager, show } = setup({})
    await manager.notify(
      download({
        status: 'failed',
        title: 'Example Video',
        error: { code: 'NetworkError', message: 'The network request failed.' }
      })
    )

    expect(show).toHaveBeenCalledWith('Download failed', 'The network request failed.')
  })

  it('does not notify for non-terminal states', async () => {
    const { manager, show } = setup({})
    await manager.notify(download({ status: 'downloading' }))
    await manager.notify(download({ status: 'cancelled' }))
    await manager.notify(download({ status: 'queued' }))

    expect(show).not.toHaveBeenCalled()
  })

  it('does not notify when notifications are disabled in settings', async () => {
    const { manager, show } = setup({
      getSettings: vi.fn().mockResolvedValue({ ...SETTINGS, notificationsEnabled: false })
    })
    await manager.notify(download({ title: 'Example Video' }))

    expect(show).not.toHaveBeenCalled()
  })

  it('does not notify when the platform does not support notifications', async () => {
    const { manager, show } = setup({ isSupported: false })
    await manager.notify(download({ title: 'Example Video' }))

    expect(show).not.toHaveBeenCalled()
  })

  it('silently ignores settings failures', async () => {
    const { manager, show } = setup({
      getSettings: vi.fn().mockRejectedValue(new Error('Failed to read settings.'))
    })
    await expect(manager.notify(download({ title: 'Example Video' }))).resolves.toBeUndefined()
    expect(show).not.toHaveBeenCalled()
  })
})
