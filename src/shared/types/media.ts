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

export interface PlaylistEntry {
  id: string
  title: string
  url: string
  duration?: number
  thumbnail?: string
}

export interface PlaylistInfo {
  id: string
  title: string
  thumbnail?: string
  website: string
  entries: PlaylistEntry[]
}

export type InspectionResult =
  | { kind: 'video'; media: MediaInfo }
  | { kind: 'playlist'; playlist: PlaylistInfo }
