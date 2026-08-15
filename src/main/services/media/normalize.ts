import type { MediaFormat, MediaInfo } from '../../../shared/types/media'
import type { PlaylistFormat } from '../../../shared/types/download'
import type { YtDlpFormat, YtDlpMedia } from '../ytdlp/types'

export function normalizeMediaInfo(raw: YtDlpMedia): MediaInfo {
  return {
    id: raw.id,
    title: raw.title,
    thumbnail: raw.thumbnail ?? raw.thumbnails?.find((t) => t.url)?.url,
    duration: raw.duration,
    uploader: raw.uploader ?? raw.channel,
    website: normalizeWebsite(raw),
    formats: normalizeFormats(raw.formats ?? [])
  }
}

function normalizeWebsite(raw: YtDlpMedia): string {
  if (raw.webpage_url_domain) {
    return raw.webpage_url_domain
  }
  if (raw.webpage_url) {
    try {
      return new URL(raw.webpage_url).hostname
    } catch {
      // Fall through to the extractor name below.
    }
  }
  return raw.extractor_key ?? raw.extractor ?? 'Unknown'
}

export function normalizeFormats(formats: YtDlpFormat[]): MediaFormat[] {
  const seen = new Set<string>()
  const result: MediaFormat[] = []
  const usable = formats.filter(isUsableFormat).sort(compareFormats)
  for (const format of usable) {
    const mediaFormat = toMediaFormat(format)
    if (seen.has(mediaFormat.label)) {
      continue
    }
    seen.add(mediaFormat.label)
    result.push(mediaFormat)
  }
  return result
}

function isUsableFormat(format: YtDlpFormat): boolean {
  if (!format.url) {
    return false
  }
  if ((format.ext ?? '').toLowerCase() === 'webm') {
    return false
  }
  return isRealCodec(format.vcodec) || isRealCodec(format.acodec)
}

export function isRealCodec(codec: string | undefined): boolean {
  return codec !== undefined && codec !== 'none'
}

function toMediaFormat(format: YtDlpFormat): MediaFormat {
  const hasVideo = isRealCodec(format.vcodec)
  const hasAudio = isRealCodec(format.acodec)
  const ext = format.ext ?? 'unknown'
  return {
    id: format.format_id ?? '',
    label: buildFormatLabel(format, hasVideo, hasAudio),
    extension: ext,
    resolution: buildResolution(format),
    videoCodec: hasVideo ? format.vcodec : undefined,
    audioCodec: hasAudio ? format.acodec : undefined,
    filesize: format.filesize ?? format.filesize_approx ?? undefined,
    hasVideo,
    hasAudio
  }
}

function buildFormatLabel(format: YtDlpFormat, hasVideo: boolean, hasAudio: boolean): string {
  const ext = format.ext ? format.ext.toUpperCase() : ''
  if (hasVideo) {
    const base = format.height ? `${format.height}p ${ext}` : `Video ${ext}`
    return base
  }
  if (hasAudio) {
    return ext ? `Audio ${ext}` : 'Audio'
  }
  return ext ? `Unknown ${ext}` : 'Unknown'
}

export function buildResolution(format: YtDlpFormat): string | undefined {
  if (format.width && format.height) {
    return `${format.width}x${format.height}`
  }
  if (format.height) {
    return `${format.height}p`
  }
  return undefined
}

function compareFormats(a: YtDlpFormat, b: YtDlpFormat): number {
  const aHasVideo = isRealCodec(a.vcodec)
  const bHasVideo = isRealCodec(b.vcodec)
  if (aHasVideo !== bHasVideo) {
    return aHasVideo ? -1 : 1
  }
  if (aHasVideo) {
    const aHeight = a.height ?? -1
    const bHeight = b.height ?? -1
    if (aHeight !== bHeight) {
      return bHeight - aHeight
    }
    const aHasAudio = isRealCodec(a.acodec)
    const bHasAudio = isRealCodec(b.acodec)
    if (aHasAudio !== bHasAudio) {
      return aHasAudio ? -1 : 1
    }
  } else {
    const aBitrate = a.abr ?? -1
    const bBitrate = b.abr ?? -1
    if (aBitrate !== bBitrate) {
      return bBitrate - aBitrate
    }
  }
  return (a.format_id ?? '').localeCompare(b.format_id ?? '')
}

const PRESET_HEIGHTS: Record<Exclude<PlaylistFormat, 'best' | 'audio'>, number> = {
  '1080': 1080,
  '720': 720,
  '480': 480,
  '360': 360
}

export function resolvePlaylistFormat(
  media: YtDlpMedia,
  preset: PlaylistFormat
): YtDlpFormat | undefined {
  const usable = (media.formats ?? []).filter(isUsableFormat)
  if (preset === 'audio') {
    const audioOnly = usable.filter(
      (format) => isRealCodec(format.acodec) && !isRealCodec(format.vcodec)
    )
    return audioOnly.sort(compareAudioOnly)[0]
  }

  const videoFormats = usable.filter((format) => isRealCodec(format.vcodec))
  if (videoFormats.length === 0) {
    return undefined
  }
  if (preset === 'best') {
    return videoFormats.sort(compareVideo)[0]
  }
  const targetHeight = PRESET_HEIGHTS[preset]
  const withinLimit = videoFormats.filter((format) => (format.height ?? Infinity) <= targetHeight)
  if (withinLimit.length > 0) {
    return withinLimit.sort(compareVideo)[0]
  }
  return [...videoFormats].sort(compareLowest)[0]
}

function compareLowest(a: YtDlpFormat, b: YtDlpFormat): number {
  const aHeight = a.height ?? Infinity
  const bHeight = b.height ?? Infinity
  if (aHeight !== bHeight) {
    return aHeight - bHeight
  }
  return extensionPreference(a.ext) - extensionPreference(b.ext)
}

function compareVideo(a: YtDlpFormat, b: YtDlpFormat): number {
  const aHeight = a.height ?? -1
  const bHeight = b.height ?? -1
  if (aHeight !== bHeight) {
    return bHeight - aHeight
  }
  const aHasAudio = isRealCodec(a.acodec)
  const bHasAudio = isRealCodec(b.acodec)
  if (aHasAudio !== bHasAudio) {
    return aHasAudio ? -1 : 1
  }
  return extensionPreference(a.ext) - extensionPreference(b.ext)
}

function compareAudioOnly(a: YtDlpFormat, b: YtDlpFormat): number {
  const aPreference = extensionPreference(a.ext)
  const bPreference = extensionPreference(b.ext)
  if (aPreference !== bPreference) {
    return aPreference - bPreference
  }
  return (b.abr ?? -1) - (a.abr ?? -1)
}

function extensionPreference(ext: string | undefined): number {
  const normalized = (ext ?? '').toLowerCase()
  if (normalized === 'mp4' || normalized === 'm4a') {
    return 0
  }
  if (normalized === 'mkv' || normalized === 'opus' || normalized === 'mp3' || normalized === 'aac') {
    return 1
  }
  return 2
}
