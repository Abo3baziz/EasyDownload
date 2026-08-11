import { useEffect, useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { Download } from '../../shared/types/download'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { useMediaDownloader } from '../hooks/useMediaDownloader'
import { formatBytes, formatDuration } from '../../shared/utils/format'

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

    const unsubscribe = api.onDownloadStateChange((download) => {
      setDownloads((previous) => {
        const index = previous.findIndex((item) => item.id === download.id)
        if (index === -1) {
          return [download, ...previous]
        }
        const next = [...previous]
        next[index] = download
        return next
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [api])

  async function handleCancel(download: Download) {
    const result = await api.cancelDownload(download.id)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleRetry(download: Download) {
    const result = await api.retryDownload(download.id)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleOpenFile(download: Download) {
    if (!download.destination) return
    const result = await api.openFile(download.destination)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleClearHistory() {
    const result = await api.clearHistory()
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDownloads(result.data)
  }

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

  const hasHistory = downloads.some((download) =>
    ['completed', 'failed', 'cancelled'].includes(download.status)
  )

  return (
    <section className="page">
      <div className="page-header">
        <h1>Downloads</h1>
        {hasHistory && (
          <button type="button" className="btn" onClick={() => void handleClearHistory()}>
            Clear history
          </button>
        )}
      </div>
      <ul className="download-list">
        {downloads.map((download) => (
          <li key={download.id} className="download-item">
            <div className="download-main">
              <span className="download-title">{download.title ?? download.url}</span>
              <StatusBadge status={download.status} />
            </div>
            <DownloadProgressBar download={download} />
            {download.status === 'completed' &&
              download.fileName &&
              download.fileSize !== undefined && (
                <p className="download-meta">
                  {download.fileName} · {formatBytes(download.fileSize)}
                </p>
              )}
            {download.error && (
              <p className="download-error">
                {download.error.code}: {download.error.message}
              </p>
            )}
            <div className="download-actions">
              {canCancel(download) && (
                <button type="button" className="btn" onClick={() => void handleCancel(download)}>
                  Cancel
                </button>
              )}
              {canRetry(download) && (
                <button type="button" className="btn" onClick={() => void handleRetry(download)}>
                  Retry
                </button>
              )}
              {download.status === 'completed' && download.destination && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleOpenFile(download)}
                >
                  Open file
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DownloadProgressBar({ download }: { download: Download }) {
  const { percent, downloadedBytes, totalBytes, speedBytesPerSecond, etaSeconds } =
    download.progress
  const progressText: string[] = []
  if (downloadedBytes !== undefined && totalBytes !== undefined) {
    progressText.push(`${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`)
  }
  if (speedBytesPerSecond !== undefined) {
    progressText.push(`${formatBytes(speedBytesPerSecond)}/s`)
  }
  if (etaSeconds !== undefined) {
    progressText.push(`ETA ${formatDuration(etaSeconds)}`)
  }

  if (percent === undefined && progressText.length === 0) {
    return null
  }

  return (
    <div className="download-progress">
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
        />
      </div>
      <span className="progress-label">
        {percent !== undefined ? `${Math.round(percent)}%` : ''}
        {progressText.length > 0 ? ` · ${progressText.join(' · ')}` : ''}
      </span>
    </div>
  )
}

function canCancel(download: Download): boolean {
  return ['queued', 'inspecting', 'downloading', 'processing'].includes(download.status)
}

function canRetry(download: Download): boolean {
  return download.status === 'failed' || download.status === 'cancelled'
}
