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
  playlistId?: string
  playlistTitle?: string
  playlistIndex?: number
  playlistCount?: number
  preset?: PlaylistFormat
  createdAt: number
  updatedAt: number
}

export interface DownloadOptions {
  url: string
  formatId?: string
  directory: string
  playlistId?: string
  playlistTitle?: string
  playlistIndex?: number
  playlistCount?: number
  preset?: PlaylistFormat
}

export type PlaylistFormat = 'best' | '1080' | '720' | '480' | '360' | 'audio'

export interface PlaylistDownloadOptions {
  url: string
  preset: PlaylistFormat
  directory: string
}

export interface PlaylistStartResult {
  playlistId: string
  created: number
  skipped: number
}
