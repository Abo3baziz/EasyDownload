import type { Conversion, ConversionStartOptions } from './conversion'
import type { DependencyStatus } from './dependencies'
import type { Download, DownloadOptions, PlaylistDownloadOptions, PlaylistStartResult } from './download'
import type { AppError } from './errors'
import type { HistoryEntry } from './history'
import type { IpcResult } from './ipc'
import type { InspectionResult } from './media'
import type { AppSettings } from './settings'

export interface PreloadApi {
  inspectUrl(url: string): Promise<IpcResult<InspectionResult>>
  startDownload(options: DownloadOptions): Promise<IpcResult<Download>>
  downloadPlaylist(options: PlaylistDownloadOptions): Promise<IpcResult<PlaylistStartResult>>
  cancelPlaylist(playlistId: string): Promise<IpcResult<void>>
  pauseDownload(id: string): Promise<IpcResult<Download>>
  resumeDownload(id: string): Promise<IpcResult<Download>>
  cancelDownload(id: string): Promise<IpcResult<Download>>
  deleteDownload(id: string): Promise<IpcResult<boolean>>
  retryDownload(id: string): Promise<IpcResult<Download>>
  getDownload(id: string): Promise<IpcResult<Download>>
  listDownloads(): Promise<IpcResult<Download[]>>
  clearHistory(): Promise<IpcResult<Download[]>>
  onDownloadDeleted(listener: (download: Download) => void): () => void
  selectDirectory(): Promise<IpcResult<string | null>>
  openFile(path: string): Promise<IpcResult<void>>
  openDirectory(path: string): Promise<IpcResult<void>>
  openFileLocation(path: string): Promise<IpcResult<void>>
  getSettings(): Promise<IpcResult<AppSettings>>
  updateSettings(settings: AppSettings): Promise<IpcResult<AppSettings>>
  getDependencies(): Promise<IpcResult<DependencyStatus[]>>
  startConversion(options: ConversionStartOptions): Promise<IpcResult<Conversion>>
  cancelConversion(id: string): Promise<IpcResult<Conversion>>
  listConversions(): Promise<IpcResult<Conversion[]>>
  onDownloadStateChange(listener: (download: Download) => void): () => void
  onConversionStateChange(listener: (conversion: Conversion) => void): () => void
  listInspectionHistory(): Promise<IpcResult<HistoryEntry[]>>
  deleteInspectionHistoryEntry(id: string): Promise<IpcResult<boolean>>
  onInspectionHistoryChange(listener: (entry: HistoryEntry) => void): () => void
  onInspectionHistoryDeleted(listener: (entry: HistoryEntry) => void): () => void
}
