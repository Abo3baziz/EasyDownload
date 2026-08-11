import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/constants/defaults'
import type { DependencyManager } from './dependencies/dependency-manager'
import { createDependencyManager } from './dependencies/dependency-manager'
import type { DownloadManager } from './download/download-manager'
import { createDownloadManager } from './download/download-manager'
import type { FileManager } from './filesystem/file-manager'
import { createFileManager } from './filesystem/file-manager'
import type { MediaService } from './media/media-service'
import { createMediaService } from './media/media-service'
import { ProcessManager } from './process/process-manager'
import type { SettingsManager } from './settings/settings-manager'
import { createSettingsManager } from './settings/settings-manager'
import type { YtDlpService } from './ytdlp/ytdlp-service'
import { createYtDlpService } from './ytdlp/ytdlp-service'
import { resolveYtDlpBinary } from './ytdlp/yt-dlp-resolver'

export interface Services {
  media: MediaService
  downloads: DownloadManager
  files: FileManager
  dependencies: DependencyManager
  settings: SettingsManager
}

export interface ServicesDeps {
  userDataDir: string
  defaultDownloadDirectory: string
  selectDirectory: () => Promise<string | null>
  openPath: (path: string) => Promise<string>
  isPackaged: boolean
  resourcesPath: string
  appPath: string
}

export function createServices(deps: ServicesDeps): Services {
  const processes = new ProcessManager()
  const ytDlpCommand =
    resolveYtDlpBinary({
      isPackaged: deps.isPackaged,
      resourcesPath: deps.resourcesPath,
      appPath: deps.appPath
    }) ?? 'yt-dlp'
  const dependencies = createDependencyManager(processes, { ytDlpCommand })
  const files = createFileManager({
    selectDirectory: deps.selectDirectory,
    openPath: deps.openPath
  })
  const settingsDefaults: AppSettings = {
    downloadDirectory: deps.defaultDownloadDirectory,
    notificationsEnabled: DEFAULT_SETTINGS.notificationsEnabled,
    concurrencyLimit: DEFAULT_SETTINGS.concurrencyLimit
  }
  const settings = createSettingsManager({ dir: deps.userDataDir, defaults: settingsDefaults })
  const ytDlp: YtDlpService = createYtDlpService({ processes, ytDlpCommand })
  const media = createMediaService({ dependencies, ytDlp })
  const downloads = createDownloadManager({ ytDlp, checkFfmpeg: () => dependencies.checkFfmpeg() })

  return { media, downloads, files, dependencies, settings }
}
