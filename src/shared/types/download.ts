import type { AppError } from './errors'

export type DownloadStatus =
  | 'queued'
  | 'inspecting'
  | 'downloading'
  | 'processing'
  | 'paused'
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
  formatId?: string
  title?: string
  status: DownloadStatus
  progress: DownloadProgress
  error?: AppError
  fileName?: string
  fileSize?: number
  destination?: string
  directory?: string
  thumbnail?: string
  duration?: number
  resolution?: string
  extension?: string
  videoCodec?: string
  audioCodec?: string
  fps?: number
  createdAt: number
  updatedAt: number
}

export interface DownloadOptions {
  url: string
  formatId: string
  directory: string
}
