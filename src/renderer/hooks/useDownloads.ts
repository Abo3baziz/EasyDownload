import { useCallback, useEffect, useState } from 'react'
import type { Download } from '../../shared/types/download'
import type { AppError } from '../../shared/types/errors'
import { useMediaDownloader } from './useMediaDownloader'

export interface DownloadsState {
  downloads: Download[]
  error: AppError | null
  replaceDownloads: (downloads: Download[]) => void
}

export function useDownloads(): DownloadsState {
  const api = useMediaDownloader()
  const [downloads, setDownloads] = useState<Download[]>([])
  const [error, setError] = useState<AppError | null>(null)

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

  const replaceDownloads = useCallback((next: Download[]) => {
    setDownloads(next)
    setError(null)
  }, [])

  return { downloads, error, replaceDownloads }
}
