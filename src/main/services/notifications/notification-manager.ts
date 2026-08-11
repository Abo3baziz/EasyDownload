import type { Download } from '../../../shared/types/download'
import type { AppSettings } from '../../../shared/types/settings'

export interface NotificationManager {
  notify(download: Download): Promise<void>
}

export interface NotificationManagerOptions {
  isSupported: () => boolean
  getSettings: () => Promise<AppSettings>
  show: (title: string, body: string) => void
}

export function createNotificationManager(options: NotificationManagerOptions): NotificationManager {
  async function notify(download: Download): Promise<void> {
    if (!options.isSupported()) {
      return
    }
    try {
      const settings = await options.getSettings()
      if (!settings.notificationsEnabled) {
        return
      }
      const content = notificationContent(download)
      if (content) {
        options.show(content.title, content.body)
      }
    } catch {
      // Notification failures must never affect the download workflow.
    }
  }

  return { notify }
}

function notificationContent(download: Download): { title: string; body: string } | undefined {
  const subject = download.title ?? download.fileName ?? download.url
  switch (download.status) {
    case 'completed':
      return { title: 'Download complete', body: subject }
    case 'failed':
      return { title: 'Download failed', body: download.error?.message ?? subject }
    default:
      return undefined
  }
}
