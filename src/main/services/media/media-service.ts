import type { InspectionResult, PlaylistInfo } from '../../../shared/types/media'
import { isValidMediaUrl } from '../../../shared/utils/url'
import { AppError } from '../../utils/errors'
import type { DependencyManager } from '../dependencies/dependency-manager'
import type { YtDlpService } from '../ytdlp/ytdlp-service'
import type { YtDlpPlaylistEntry } from '../ytdlp/types'
import { normalizeMediaInfo } from './normalize'

export interface MediaService {
  inspectUrl(url: string): Promise<InspectionResult>
}

export interface MediaServiceOptions {
  dependencies: DependencyManager
  ytDlp: YtDlpService
}

export function createMediaService(options: MediaServiceOptions): MediaService {
  return {
    async inspectUrl(url: string): Promise<InspectionResult> {
      if (!isValidMediaUrl(url)) {
        throw new AppError('ValidationError', 'The provided URL is not a valid HTTP(S) URL.')
      }

      const ytDlp = await options.dependencies.checkYtDlp()
      if (!ytDlp.available) {
        throw new AppError('DependencyError', 'yt-dlp is not available.')
      }

      const raw = await options.ytDlp.inspectFlat(url)
      if (isPlaylist(raw)) {
        return { kind: 'playlist', playlist: normalizePlaylist(raw) }
      }
      return { kind: 'video', media: normalizeMediaInfo(raw) }
    }
  }
}

function isPlaylist(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) {
    return false
  }
  const candidate = raw as { _type?: unknown; entries?: unknown }
  return candidate._type === 'playlist' || Array.isArray(candidate.entries)
}

function normalizePlaylist(raw: {
  id?: string
  title?: string
  thumbnail?: string
  thumbnails?: Array<{ url?: string }>
  webpage_url_domain?: string
  webpage_url?: string
  extractor_key?: string
  extractor?: string
  entries?: YtDlpPlaylistEntry[]
}): PlaylistInfo {
  const entries: PlaylistInfo['entries'] = (raw.entries ?? []).flatMap((entry) => {
    if (!entry.url) {
      return []
    }
    return [
      {
        id: entry.id ?? '',
        title: entry.title ?? entry.id ?? 'Untitled',
        url: entry.url,
        duration: entry.duration,
        thumbnail: entry.thumbnails?.find((t) => t.url)?.url
      }
    ]
  })

  return {
    id: raw.id ?? '',
    title: raw.title ?? 'Playlist',
    thumbnail: raw.thumbnail ?? raw.thumbnails?.find((t) => t.url)?.url,
    website: raw.webpage_url_domain ?? extractHostname(raw.webpage_url) ?? raw.extractor_key ?? raw.extractor ?? 'Unknown',
    entries
  }
}

function extractHostname(webpageUrl: string | undefined): string | undefined {
  if (!webpageUrl) {
    return undefined
  }
  try {
    return new URL(webpageUrl).hostname
  } catch {
    return undefined
  }
}
