export interface MediaInfo {
  id: string
  title: string
  thumbnail?: string
  duration?: number
  uploader?: string
  website: string
  formats: MediaFormat[]
}

export interface MediaFormat {
  id: string
  label: string
  extension: string
  resolution?: string
  videoCodec?: string
  audioCodec?: string
  filesize?: number
  hasVideo: boolean
  hasAudio: boolean
}
