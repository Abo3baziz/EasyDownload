import { describe, expect, it, vi } from 'vitest'
import type { DependencyManager } from '../dependencies/dependency-manager'
import type { YtDlpMedia } from '../ytdlp/types'
import type { YtDlpService } from '../ytdlp/ytdlp-service'
import { createMediaService } from './media-service'

const RAW_MEDIA: YtDlpMedia = {
  id: 'abc123',
  title: 'Example Video',
  thumbnail: 'https://example.com/thumb.jpg',
  duration: 120,
  uploader: 'Example Channel',
  webpage_url_domain: 'www.youtube.com',
  formats: [
    {
      format_id: '18',
      ext: 'mp4',
      height: 360,
      vcodec: 'avc1.42001E',
      acodec: 'mp4a.40.2',
      url: 'https://example.com/small.mp4'
    }
  ]
}

function createDependencyMock(available = true): DependencyManager {
  return {
    checkYtDlp: vi.fn().mockResolvedValue({ name: 'yt-dlp', available }),
    checkFfmpeg: vi.fn(),
    checkAll: vi.fn()
  } as unknown as DependencyManager
}

function createYtDlpMock(inspect = vi.fn()): YtDlpService {
  return { inspect } as unknown as YtDlpService
}

describe('createMediaService', () => {
  it('returns normalized media info for a valid URL', async () => {
    const ytDlp = createYtDlpMock(vi.fn().mockResolvedValue(RAW_MEDIA))
    const media = createMediaService({ dependencies: createDependencyMock(), ytDlp })

    const result = await media.inspectUrl('https://www.youtube.com/watch?v=abc123')

    expect(result.kind).toBe('video')
    if (result.kind !== 'video') {
      throw new Error('expected a video result')
    }
    expect(result.media.id).toBe('abc123')
    expect(result.media.title).toBe('Example Video')
    expect(result.media.website).toBe('www.youtube.com')
    expect(result.media.formats.map((f) => f.label)).toEqual(['360p MP4'])
    expect(ytDlp.inspect).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123')
  })

  it('returns a playlist result when yt-dlp reports a playlist', async () => {
    const playlist: YtDlpMedia = {
      id: 'PL123',
      title: 'Example Playlist',
      _type: 'playlist',
      webpage_url_domain: 'www.youtube.com',
      entries: [
        {
          id: 'v1',
          title: 'First Video',
          url: 'https://www.youtube.com/watch?v=v1',
          duration: 60
        },
        {
          id: 'v2',
          title: 'Second Video',
          url: 'https://www.youtube.com/watch?v=v2'
        },
        {
          id: 'v3',
          title: 'No Url Video',
          url: undefined
        }
      ]
    }
    const ytDlp = createYtDlpMock(vi.fn().mockResolvedValue(playlist))
    const media = createMediaService({ dependencies: createDependencyMock(), ytDlp })

    const result = await media.inspectUrl('https://www.youtube.com/playlist?list=PL123')

    expect(result.kind).toBe('playlist')
    if (result.kind !== 'playlist') {
      throw new Error('expected a playlist result')
    }
    expect(result.playlist.id).toBe('PL123')
    expect(result.playlist.title).toBe('Example Playlist')
    expect(result.playlist.website).toBe('www.youtube.com')
    expect(result.playlist.entries).toEqual([
      {
        id: 'v1',
        title: 'First Video',
        url: 'https://www.youtube.com/watch?v=v1',
        duration: 60,
        thumbnail: undefined
      },
      {
        id: 'v2',
        title: 'Second Video',
        url: 'https://www.youtube.com/watch?v=v2',
        duration: undefined,
        thumbnail: undefined
      }
    ])
  })

  it('rejects invalid URLs without invoking yt-dlp', async () => {
    const ytDlp = createYtDlpMock()
    const media = createMediaService({ dependencies: createDependencyMock(), ytDlp })

    await expect(media.inspectUrl('not-a-url')).rejects.toMatchObject({
      code: 'ValidationError'
    })
    expect(ytDlp.inspect).not.toHaveBeenCalled()
  })

  it('rejects inspection when yt-dlp is not available', async () => {
    const ytDlp = createYtDlpMock()
    const media = createMediaService({ dependencies: createDependencyMock(false), ytDlp })

    await expect(media.inspectUrl('https://example.com/video')).rejects.toMatchObject({
      code: 'DependencyError'
    })
    expect(ytDlp.inspect).not.toHaveBeenCalled()
  })

  it('propagates errors raised by the yt-dlp service', async () => {
    const ytDlp = createYtDlpMock(vi.fn().mockRejectedValue({ code: 'UnsupportedMediaError', message: 'no' }))
    const media = createMediaService({ dependencies: createDependencyMock(), ytDlp })

    await expect(media.inspectUrl('https://example.com/bad')).rejects.toMatchObject({
      code: 'UnsupportedMediaError'
    })
  })
})
