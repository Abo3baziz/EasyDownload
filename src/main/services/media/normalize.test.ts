import { describe, expect, it } from 'vitest'
import type { YtDlpFormat, YtDlpMedia } from '../ytdlp/types'
import { normalizeFormats, normalizeMediaInfo, resolvePlaylistFormat } from './normalize'

const SAMPLE_RAW: YtDlpMedia = {
  id: 'abc123',
  title: 'Example Video',
  thumbnail: 'https://example.com/thumb.jpg',
  duration: 120,
  uploader: 'Example Channel',
  webpage_url_domain: 'www.youtube.com',
  formats: [
    {
      format_id: '137',
      ext: 'mp4',
      height: 1080,
      width: 1920,
      vcodec: 'avc1.640028',
      acodec: 'none',
      filesize_approx: 1048576,
      url: 'https://example.com/video.mp4'
    },
    {
      format_id: '18',
      ext: 'mp4',
      height: 360,
      vcodec: 'avc1.42001E',
      acodec: 'mp4a.40.2',
      url: 'https://example.com/small.mp4'
    },
    {
      format_id: '140',
      ext: 'm4a',
      vcodec: 'none',
      acodec: 'mp4a.40.2',
      abr: 128,
      filesize: 524288,
      url: 'https://example.com/audio.m4a'
    }
  ]
}

describe('normalizeMediaInfo', () => {
  it('normalizes core metadata fields', () => {
    const media = normalizeMediaInfo(SAMPLE_RAW)
    expect(media.id).toBe('abc123')
    expect(media.title).toBe('Example Video')
    expect(media.thumbnail).toBe('https://example.com/thumb.jpg')
    expect(media.duration).toBe(120)
    expect(media.uploader).toBe('Example Channel')
    expect(media.website).toBe('www.youtube.com')
  })

  it('falls back to channel when uploader is missing', () => {
    const media = normalizeMediaInfo({ ...SAMPLE_RAW, uploader: undefined, channel: 'Channel Only' })
    expect(media.uploader).toBe('Channel Only')
  })

  it('derives website from the webpage URL when the domain is missing', () => {
    const raw: YtDlpMedia = {
      ...SAMPLE_RAW,
      webpage_url_domain: undefined,
      webpage_url: 'https://vimeo.com/12345'
    }
    expect(normalizeMediaInfo(raw).website).toBe('vimeo.com')
  })
})

describe('normalizeFormats', () => {
  it('sorts video formats by height descending and audio formats last', () => {
    const formats = normalizeFormats(SAMPLE_RAW.formats ?? [])
    expect(formats.map((f) => f.label)).toEqual(['1080p MP4', '360p MP4', 'Audio M4A'])
  })

  it('labels combined audio+video formats by resolution', () => {
    const combined: YtDlpFormat = {
      format_id: '18',
      ext: 'mp4',
      height: 360,
      vcodec: 'avc1.42001E',
      acodec: 'mp4a.40.2',
      url: 'https://example.com/v.mp4'
    }
    const format = normalizeFormats([combined])[0]
    expect(format?.label).toBe('360p MP4')
    expect(format?.hasVideo).toBe(true)
    expect(format?.hasAudio).toBe(true)
    expect(format?.extension).toBe('mp4')
  })

  it('labels audio-only formats as Audio', () => {
    const audio: YtDlpFormat = {
      format_id: '140',
      ext: 'm4a',
      vcodec: 'none',
      acodec: 'mp4a.40.2',
      url: 'https://example.com/a.m4a'
    }
    const format = normalizeFormats([audio])[0]
    expect(format?.label).toBe('Audio M4A')
    expect(format?.hasVideo).toBe(false)
    expect(format?.hasAudio).toBe(true)
  })

  it('uses filesize and falls back to filesize_approx', () => {
    const exact: YtDlpFormat = {
      format_id: '1',
      ext: 'mp4',
      height: 720,
      vcodec: 'avc1',
      acodec: 'mp4a',
      filesize: 1000,
      url: 'https://example.com/v.mp4'
    }
    expect(normalizeFormats([exact])[0]?.filesize).toBe(1000)
  })

  it('drops formats without a download URL', () => {
    const noUrl: YtDlpFormat = {
      format_id: '999',
      ext: 'mp4',
      vcodec: 'avc1',
      acodec: 'mp4a'
    }
    expect(normalizeFormats([noUrl])).toEqual([])
  })

  it('drops storyboard formats without video or audio codecs', () => {
    const storyboard: YtDlpFormat = {
      format_id: 'sb0',
      ext: 'mhtml',
      vcodec: 'none',
      acodec: 'none',
      url: 'https://example.com/sb'
    }
    expect(normalizeFormats([storyboard])).toEqual([])
  })

  it('drops WebM formats from download options', () => {
    const webmVideo: YtDlpFormat = {
      format_id: '248',
      ext: 'webm',
      height: 1080,
      vcodec: 'vp9',
      acodec: 'none',
      url: 'https://example.com/v.webm'
    }
    const webmAudio: YtDlpFormat = {
      format_id: '251',
      ext: 'webm',
      vcodec: 'none',
      acodec: 'opus',
      url: 'https://example.com/a.webm'
    }
    const mp4: YtDlpFormat = {
      format_id: '18',
      ext: 'mp4',
      height: 360,
      vcodec: 'avc1',
      acodec: 'mp4a',
      url: 'https://example.com/v.mp4'
    }
    const formats = normalizeFormats([webmVideo, webmAudio, mp4])
    expect(formats.map((f) => f.id)).toEqual(['18'])
  })

  it('deduplicates formats that share the same label', () => {
    const dup: YtDlpFormat = {
      format_id: '137-1',
      ext: 'mp4',
      height: 1080,
      vcodec: 'vp9',
      acodec: 'none',
      url: 'https://example.com/dup.mp4'
    }
    const formats = normalizeFormats([...SAMPLE_RAW.formats!, dup])
    expect(formats.filter((f) => f.label === '1080p MP4')).toHaveLength(1)
  })
})

describe('resolvePlaylistFormat', () => {
  const video1080Audio = format('137', { height: 1080, vcodec: 'avc1', acodec: 'mp4a', ext: 'mp4' })
  const video1080Only = format('137v', { height: 1080, vcodec: 'avc1', acodec: 'none', ext: 'mp4' })
  const video720Audio = format('22', { height: 720, vcodec: 'avc1', acodec: 'mp4a', ext: 'mp4' })
  const video360Audio = format('18', { height: 360, vcodec: 'avc1', acodec: 'mp4a', ext: 'mp4' })
  const video2160Audio = format('401', { height: 2160, vcodec: 'avc1', acodec: 'mp4a', ext: 'mp4' })
  const audio = format('140', { vcodec: 'none', acodec: 'mp4a', abr: 128, ext: 'm4a' })

  function media(...formats: YtDlpFormat[]): YtDlpMedia {
    return { id: 'v1', title: 'Video', formats }
  }

  it('best picks the highest resolution video format', () => {
    const resolved = resolvePlaylistFormat(media(video720Audio, video1080Audio), 'best')
    expect(resolved?.format_id).toBe('137')
  })

  it('best picks a video-only format when it is the highest resolution', () => {
    const resolved = resolvePlaylistFormat(media(video720Audio, video1080Only), 'best')
    expect(resolved?.format_id).toBe('137v')
  })

  it('a numeric preset picks the highest video format within the height limit', () => {
    const resolved = resolvePlaylistFormat(
      media(video2160Audio, video1080Audio, video720Audio),
      '720'
    )
    expect(resolved?.format_id).toBe('22')
  })

  it('a numeric preset falls back to the lowest format when all exceed the limit', () => {
    const resolved = resolvePlaylistFormat(media(video1080Audio, video2160Audio), '720')
    expect(resolved?.format_id).toBe('137')
  })

  it('audio picks the best audio-only format', () => {
    const resolved = resolvePlaylistFormat(media(video720Audio, audio), 'audio')
    expect(resolved?.format_id).toBe('140')
  })

  it('returns undefined when no video format is available', () => {
    expect(resolvePlaylistFormat(media(audio), 'best')).toBeUndefined()
  })

  it('ignores formats without usable download URLs', () => {
    const noUrl = format('137', { height: 1080, vcodec: 'avc1', acodec: 'mp4a', ext: 'mp4', url: undefined })
    expect(resolvePlaylistFormat(media(noUrl), 'best')).toBeUndefined()
  })
})

function format(
  formatId: string,
  overrides: Partial<YtDlpFormat> & { url?: string }
): YtDlpFormat {
  return {
    format_id: formatId,
    ext: 'mp4',
    url: `https://example.com/${formatId}.mp4`,
    ...overrides
  }
}
