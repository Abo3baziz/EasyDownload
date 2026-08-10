import { useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { MediaInfo } from '../../shared/types/media'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export function HomePage() {
  const api = useMediaDownloader()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [media, setMedia] = useState<MediaInfo | null>(null)
  const [error, setError] = useState<AppError | null>(null)

  async function handleInspect() {
    setBusy(true)
    setError(null)
    setMedia(null)
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
        message: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <h1>Media Downloader</h1>
      <form
        className="inspect-form"
        onSubmit={(event) => {
          event.preventDefault()
          void handleInspect()
        }}
      >
        <label className="field">
          <span>Media URL</span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/watch?v=..."
            aria-label="Media URL"
            required
          />
        </label>
        <button type="submit" disabled={busy || url.trim() === ''}>
          {busy ? 'Inspecting…' : 'Inspect'}
        </button>
      </form>

      {error && (
        <div className="alert" role="alert">
          <strong>{error.code}</strong> {error.message}
        </div>
      )}

      {media && (
        <div className="media-card">
          <h2>{media.title}</h2>
          <p>Formats: {media.formats.length}</p>
        </div>
      )}
    </section>
  )
}
