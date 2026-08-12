import type { AppError } from './errors'

export type VideoCodec = 'copy' | 'h264' | 'hevc' | 'vp9'
export type AudioCodec = 'copy' | 'mp3' | 'aac' | 'opus' | 'flac' | 'vorbis'

export type ConversionType = 'convert' | 'extractAudio'
export type ConversionStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface ConversionProgress {
  processedMs: number
}

export interface Conversion {
  id: string
  type: ConversionType
  input: string
  output: string
  status: ConversionStatus
  progress: ConversionProgress
  error?: AppError
  title?: string
  thumbnail?: string
  duration?: number
  fileSize?: number
  createdAt: number
  updatedAt: number
}

export interface ConversionStartOptions {
  type: ConversionType
  input: string
  videoCodec?: VideoCodec
  audioCodec?: AudioCodec
  title?: string
  thumbnail?: string
  duration?: number
}
