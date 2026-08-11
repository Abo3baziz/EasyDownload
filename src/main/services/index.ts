import { stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppSettings } from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/constants/defaults'
import type { DependencyManager } from './dependencies/dependency-manager'
import { createDependencyManager } from './dependencies/dependency-manager'
import type { DownloadManager } from './download/download-manager'
import { createDownloadManager } from './download/download-manager'
import { resolveFfmpegBinary } from './ffmpeg/ffmpeg-resolver'
import type { FileManager } from './filesystem/file-manager'
import { createFileManager } from './filesystem/file-manager'
import type { HistoryManager } from './history/history-manager'
import { createHistoryManager } from './history/history-manager'
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
  history: HistoryManager
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
  const ffmpegBinary = resolveFfmpegBinary({
    isPackaged: deps.isPackaged,
    resourcesPath: deps.resourcesPath,
    appPath: deps.appPath
  })
  const ffmpegCommand = ffmpegBinary ?? 'ffmpeg'
  const ffmpegLocation = ffmpegBinary ? dirname(ffmpegBinary) : undefined
  const dependencies = createDependencyManager(processes, { ytDlpCommand, ffmpegCommand })
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
  const history = createHistoryManager({ dir: deps.userDataDir })
  const ytDlp: YtDlpService = createYtDlpService({ processes, ytDlpCommand, ffmpegLocation })
  const media = createMediaService({ dependencies, ytDlp })
  const downloads = createDownloadManager({
    ytDlp,
    checkFfmpeg: () => dependencies.checkFfmpeg(),
    history,
    statFile: async (path) => {
      try {
        const info = await stat(path)
        return { size: info.size }
      } catch {
        return undefined
      }
    }
  })

  return { media, downloads, files, dependencies, settings, history }
}
