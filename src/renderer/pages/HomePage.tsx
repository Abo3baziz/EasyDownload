import { useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { MediaFormat, MediaInfo } from '../../shared/types/media'
import { formatBytes, formatDuration } from '../../shared/utils/format'
import { useMediaDownloader } from '../hooks/useMediaDownloader'
import { useHomeState } from '../state/homeState'

export function HomePage() {
  const api = useMediaDownloader()
  const {
    url,
    setUrl,
    clearUrl,
    getInspection,
    setInspection,
    isDownloading,
    markDownloading,
    unmarkDownloading
  } = useHomeState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const media = url.trim() === '' ? null : (getInspection(url) ?? null)

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
    if (!media) {
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

      {media && (
        <MediaDetails
          media={media}
          isFormatDownloading={(formatId) => isDownloading(url, formatId)}
          onDownload={(format) => void handleDownload(format)}
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
