import { useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { MediaFormat, MediaInfo } from '../../shared/types/media'
import { formatBytes, formatDuration } from '../../shared/utils/format'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export function HomePage() {
  const api = useMediaDownloader()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [media, setMedia] = useState<MediaInfo | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [startingFormatId, setStartingFormatId] = useState<string | null>(null)

  async function handleInspect() {
    setBusy(true)
    setError(null)
    setMedia(null)
    setNotice(null)
    try {
      const result = await api.inspectUrl(url)
      if (result.ok) {
        setMedia(result.data)
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
    if (!media) {
      return
    }
    setStartingFormatId(format.id)
    setError(null)
    setNotice(null)
    try {
      const settings = await api.getSettings()
      if (!settings.ok) {
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
        setError(result.error)
      }
    } catch (err) {
      setError({
        code: 'UnknownError',
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setStartingFormatId(null)
    }
  }

  return (
    <section className='page'>
      <h1>Media Downloader</h1>
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

      {media && (
        <MediaDetails
          media={media}
          startingFormatId={startingFormatId}
          onDownload={(format) => void handleDownload(format)}
        />
      )}
    </section>
  )
}

function MediaDetails({
  media,
  startingFormatId,
  onDownload,
}: {
  media: MediaInfo
  startingFormatId: string | null
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
        {media.formats.map((format) => (
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
              disabled={startingFormatId !== null}
              onClick={() => onDownload(format)}>
              {startingFormatId === format.id ? 'Starting…' : 'Download'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
