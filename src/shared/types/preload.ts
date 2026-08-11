import type { DependencyStatus } from './dependencies'
import type { Download, DownloadOptions } from './download'
import type { AppError } from './errors'
import type { IpcResult } from './ipc'
import type { MediaInfo } from './media'
import type { AppSettings } from './settings'

export interface PreloadApi {
  inspectUrl(url: string): Promise<IpcResult<MediaInfo>>
  startDownload(options: DownloadOptions): Promise<IpcResult<Download>>
  cancelDownload(id: string): Promise<IpcResult<Download>>
  retryDownload(id: string): Promise<IpcResult<Download>>
  getDownload(id: string): Promise<IpcResult<Download>>
  listDownloads(): Promise<IpcResult<Download[]>>
  clearHistory(): Promise<IpcResult<Download[]>>
  selectDirectory(): Promise<IpcResult<string | null>>
  openFile(path: string): Promise<IpcResult<void>>
  openDirectory(path: string): Promise<IpcResult<void>>
  getSettings(): Promise<IpcResult<AppSettings>>
  updateSettings(settings: AppSettings): Promise<IpcResult<AppSettings>>
  getDependencies(): Promise<IpcResult<DependencyStatus[]>>
  onDownloadStateChange(listener: (download: Download) => void): () => void
}
