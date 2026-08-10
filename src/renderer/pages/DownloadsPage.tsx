import { useEffect, useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { Download } from '../../shared/types/download'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export function DownloadsPage() {
  const api = useMediaDownloader()
  const [downloads, setDownloads] = useState<Download[]>([])
  const [error, setError] = useState<AppError | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await api.listDownloads()
        if (cancelled) return
        if (result.ok) {
          setDownloads(result.data)
        } else {
          setError(result.error)
        }
      } catch (err) {
        if (cancelled) return
        setError({
          code: 'UnknownError',
          message: err instanceof Error ? err.message : String(err)
        })
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api])

  if (error) {
    return (
      <section className="page">
        <h1>Downloads</h1>
        <div className="alert" role="alert">
          <strong>{error.code}</strong> {error.message}
        </div>
      </section>
    )
  }

  if (!loaded || downloads.length === 0) {
    return (
      <section className="page">
        <h1>Downloads</h1>
        <EmptyState message="No downloads yet. Inspect a media URL to get started." />
      </section>
    )
  }

  return (
    <section className="page">
      <h1>Downloads</h1>
      <ul className="download-list">
        {downloads.map((download) => (
          <li key={download.id} className="download-item">
            <div className="download-main">
              <span className="download-title">{download.title ?? download.url}</span>
              <StatusBadge status={download.status} />
            </div>
            {download.error && (
              <p className="download-error">
                {download.error.code}: {download.error.message}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
