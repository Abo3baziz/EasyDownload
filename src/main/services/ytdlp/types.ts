export interface YtDlpFormat {
  format_id?: string
  format_note?: string
  format?: string
  ext?: string
  height?: number
  width?: number
  fps?: number
  vcodec?: string
  acodec?: string
  filesize?: number | null
  filesize_approx?: number | null
  tbr?: number
  abr?: number
  vbr?: number
  url?: string
  protocol?: string
}

export interface YtDlpMedia {
  id: string
  title: string
  thumbnail?: string
  thumbnails?: Array<{ url?: string }>
  duration?: number
  uploader?: string
  channel?: string
  webpage_url?: string
  webpage_url_domain?: string
  extractor?: string
  extractor_key?: string
  formats?: YtDlpFormat[]
  _type?: string
  entries?: YtDlpPlaylistEntry[]
  playlist_id?: string
  playlist_title?: string
}

export interface YtDlpPlaylistEntry {
  id?: string
  title?: string
  url?: string
  duration?: number
  thumbnails?: Array<{ url?: string }>
}
