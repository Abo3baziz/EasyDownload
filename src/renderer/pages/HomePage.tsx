import { useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { PlaylistFormat } from '../../shared/types/download'
import type { Download } from '../../shared/types/download'
import type { InspectionResult, MediaFormat, MediaInfo, PlaylistInfo } from '../../shared/types/media'
import { formatBytes, formatDuration } from '../../shared/utils/format'
import { useDownloads } from '../hooks/useDownloads'
import { useMediaDownloader } from '../hooks/useMediaDownloader'
import { useHomeState } from '../state/homeState'

export function HomePage() {
  const api = useMediaDownloader()
  const { downloads } = useDownloads()
  const {
    url,
    setUrl,
    clearUrl,
    getInspection,
    setInspection,
    isDownloading,
    markDownloading,
    unmarkDownloading,
    isPlaylistActive,
    markPlaylistDownloading,
    unmarkPlaylistDownloading
  } = useHomeState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const inspection = url.trim() === '' ? null : (getInspection(url) ?? null)

  async function handleInspect() {
    const targetUrl = url
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await api.inspectUrl(targetUrl)
      if (result.ok) {
        setInspection(targetUrl, result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError({
        code: 'UnknownError',
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(format: MediaFormat) {
    if (!inspection || inspection.kind !== 'video') {
      return
    }
    if (!markDownloading(url, format.id)) {
      return
    }
    setError(null)
    setNotice(null)
    try {
      const settings = await api.getSettings()
      if (!settings.ok) {
        unmarkDownloading(url, format.id)
        setError(settings.error)
        return
      }
      const result = await api.startDownload({
        url,
        formatId: format.id,
        directory: settings.data.downloadDirectory,
      })
      if (result.ok) {
        setNotice('Download started. Track its progress on the Downloads page.')
      } else {
        unmarkDownloading(url, format.id)
        setError(result.error)
      }
    } catch (err) {
      unmarkDownloading(url, format.id)
      setError({
        code: 'UnknownError',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleDownloadPlaylist(playlist: PlaylistInfo, preset: PlaylistFormat) {
    if (!markPlaylistDownloading(playlist.id)) {
      return
    }
    setError(null)
    setNotice(null)
    try {
      const settings = await api.getSettings()
      if (!settings.ok) {
        unmarkPlaylistDownloading(playlist.id)
        setError(settings.error)
        return
      }
      const result = await api.downloadPlaylist({
        url,
        preset,
        directory: settings.data.downloadDirectory,
      })
      if (result.ok) {
        const skipped =
          result.data.skipped > 0
            ? ` (${result.data.skipped} already downloaded and skipped)`
            : ''
        setNotice(
          `Playlist download started: ${result.data.created} videos queued${skipped}. Track progress on the Downloads page.`
        )
      } else {
        unmarkPlaylistDownloading(playlist.id)
        setError(result.error)
      }
    } catch (err) {
      unmarkPlaylistDownloading(playlist.id)
      setError({
        code: 'UnknownError',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <section className='page'>
      <h1>EasyDownload</h1>
      <form
        className='inspect-form'
        onSubmit={(event) => {
          event.preventDefault()
          void handleInspect()
        }}>
        <div className='field-group'>
          <label className='field'>
            <span>Media URL</span>
            <input
              type='url'
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder='https://example.com/watch?v=...'
              aria-label='Media URL'
              required
            />
          </label>
          <button
            type='submit'
            disabled={busy || url.trim() === ''}>
            {busy ? 'Inspecting…' : 'Inspect'}
          </button>
          <button
            type='button'
            disabled={busy || url.trim() === ''}
            onClick={clearUrl}>
            Clear
          </button>
        </div>
      </form>

      {notice && (
        <div
          className='notice'
          role='status'>
          {notice}
        </div>
      )}

      {error && (
        <div
          className='alert'
          role='alert'>
          <strong>{error.code}</strong> {error.message}
        </div>
      )}

      {inspection && inspection.kind === 'video' && (
        <MediaDetails
          media={inspection.media}
          isFormatDownloading={(formatId) => isDownloading(url, formatId)}
          onDownload={(format) => void handleDownload(format)}
        />
      )}

      {inspection && inspection.kind === 'playlist' && (
        <PlaylistCard
          key={inspection.playlist.id}
          playlist={inspection.playlist}
          active={isPlaylistActive(inspection.playlist.id)}
          downloads={downloads.filter((download) => download.playlistId === inspection.playlist.id)}
          onDownload={(preset) => void handleDownloadPlaylist(inspection.playlist, preset)}
        />
      )}
    </section>
  )
}

function MediaDetails({
  media,
  isFormatDownloading,
  onDownload,
}: {
  media: MediaInfo
  isFormatDownloading: (formatId: string) => boolean
  onDownload: (format: MediaFormat) => void
}) {
  const meta: string[] = []
  if (media.uploader) {
    meta.push(media.uploader)
  }
  if (media.duration !== undefined) {
    meta.push(formatDuration(media.duration))
  }
  if (media.website) {
    meta.push(media.website)
  }

  return (
    <div className='media-card'>
      <div className='media-header'>
        {media.thumbnail && (
          <img
            className='media-thumbnail'
            src={media.thumbnail}
            alt=''
          />
        )}
        <div className='media-heading'>
          <h2>{media.title}</h2>
          {meta.length > 0 && <p className='media-meta'>{meta.join(' · ')}</p>}
        </div>
      </div>

      <h3>Formats</h3>
      <ul className='format-list'>
        {media.formats.map((format) => {
          const downloading = isFormatDownloading(format.id)
          return (
            <li
              key={format.id}
              className='format-item'>
              <div className='format-info'>
                <span className='format-label'>{format.label}</span>
                <span className='format-details'>
                  {format.hasVideo && format.resolution && <span>{format.resolution}</span>}
                  {format.videoCodec && <span>{format.videoCodec}</span>}
                  {format.audioCodec && <span>{format.audioCodec}</span>}
                  {format.filesize !== undefined && <span>{formatBytes(format.filesize)}</span>}
                </span>
              </div>
              <button
                type='button'
                className='btn'
                disabled={downloading}
                onClick={() => onDownload(format)}>
                {downloading ? 'Downloading' : 'Download'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const PRESETS: ReadonlyArray<{ value: PlaylistFormat; label: string }> = [
  { value: 'best', label: 'Best' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' },
  { value: 'audio', label: 'Audio' }
]

function PlaylistCard({
  playlist,
  active,
  downloads,
  onDownload,
}: {
  playlist: PlaylistInfo
  active: boolean
  downloads: Download[]
  onDownload: (preset: PlaylistFormat) => void
}) {
  const [preset, setPreset] = useState<PlaylistFormat>('best')
  const meta: string[] = []
  if (playlist.website) {
    meta.push(playlist.website)
  }
  meta.push(`${playlist.entries.length} video${playlist.entries.length === 1 ? '' : 's'}`)

  const total = downloads[0]?.playlistCount ?? downloads.length
  const completed = downloads.filter((download) => download.status === 'completed').length
  const activeCredit = downloads
    .filter(
      (download) => download.status === 'downloading' || download.status === 'processing'
    )
    .reduce((sum, download) => sum + (download.progress.percent ?? 0) / 100, 0)
  const overall =
    total > 0 ? Math.min(100, Math.round(((completed + activeCredit) / total) * 100)) : 0

  return (
    <div className='media-card'>
      <div className='media-header'>
        {playlist.thumbnail && (
          <img
            className='media-thumbnail'
            src={playlist.thumbnail}
            alt=''
          />
        )}
        <div className='media-heading'>
          <h2>{playlist.title}</h2>
          {meta.length > 0 && <p className='media-meta'>{meta.join(' · ')}</p>}
        </div>
      </div>

      <h3>Playlist quality</h3>
      <div
        className='playlist-presets'
        role='radiogroup'
        aria-label='Playlist quality'>
        {PRESETS.map((option) => (
          <label
            key={option.value}
            className={preset === option.value ? 'playlist-preset selected' : 'playlist-preset'}>
            <input
              type='radio'
              name='playlist-preset'
              value={option.value}
              checked={preset === option.value}
              onChange={() => setPreset(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {active ? (
        <div className='playlist-download-progress'>
          <div className='progress-track'>
            <div
              className='progress-fill'
              style={{ width: `${overall}%` }}
            />
          </div>
          <span className='progress-label'>
            {completed} of {total} videos · {overall}%
          </span>
        </div>
      ) : (
        <button
          type='button'
          className='btn'
          disabled={active}
          onClick={() => onDownload(preset)}>
          Download playlist
        </button>
      )}
    </div>
  )
}
