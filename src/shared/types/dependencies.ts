export type DependencyName = 'yt-dlp' | 'ffmpeg'

export interface DependencyStatus {
  name: DependencyName
  available: boolean
  version?: string
}
