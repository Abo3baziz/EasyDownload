import type { AppError } from './errors'

export type DownloadStatus =
  | 'queued'
  | 'inspecting'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface DownloadProgress {
  percent?: number
  downloadedBytes?: number
  totalBytes?: number
  speedBytesPerSecond?: number
  etaSeconds?: number
}

export interface Download {
  id: string
  url: string
  title?: string
  status: DownloadStatus
  progress: DownloadProgress
  error?: AppError
  fileName?: string
  destination?: string
  directory?: string
  createdAt: number
  updatedAt: number
}

export interface DownloadOptions {
  url: string
  formatId: string
  directory: string
}
