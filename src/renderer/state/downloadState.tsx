import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { ReactNode } from 'react'
import type { Download, DownloadStatus } from '../../shared/types/download'
import type { AppError } from '../../shared/types/errors'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

const QUEUE_STATUSES: DownloadStatus[] = ['queued', 'inspecting', 'downloading', 'processing', 'paused']
const TERMINAL_STATUSES: DownloadStatus[] = ['completed', 'failed', 'cancelled']

export interface DownloadCounts {
  queue: number
  completed: number
  cancelled: number
  failed: number
}

export interface DownloadsData {
  downloads: Download[]
  replaceDownloads: (downloads: Download[]) => void
}

export interface DownloadsMeta {
  loaded: boolean
  error: AppError | null
  counts: DownloadCounts
}

const DownloadsDataContext = createContext<DownloadsData | null>(null)
const DownloadsMetaContext = createContext<DownloadsMeta | null>(null)

export function DownloadsStateProvider({ children }: { children: ReactNode }) {
  const api = useMediaDownloader()
  const [downloads, setDownloads] = useState<Download[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const pendingRef = useRef<Download[]>([])
  const tombstonesRef = useRef<Set<string>>(new Set())
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const unsubscribe = api.onDownloadStateChange((download) => {
      if (!loadedRef.current) {
        pendingRef.current.push(download)
      }
      setDownloads((previous) => applyState(previous, download, tombstonesRef.current))
    })

    const unsubscribeDelete = api.onDownloadDeleted((download) => {
      tombstonesRef.current.add(download.id)
      setDownloads((previous) => previous.filter((item) => item.id !== download.id))
    })

    void (async () => {
      try {
        const result = await api.listDownloads()
        if (cancelled) return
        if (result.ok) {
          const pending = pendingRef.current
          pendingRef.current = []
          setDownloads(mergeSnapshot(result.data, pending, tombstonesRef.current))
        } else {
          setError(result.error)
        }
      } catch (err) {
        if (!cancelled) {
          setError({
            code: 'UnknownError',
            message: err instanceof Error ? err.message : String(err)
          })
        }
      }
      if (!cancelled) {
        loadedRef.current = true
        setLoaded(true)
      }
    })()

    return () => {
      cancelled = true
      unsubscribe()
      unsubscribeDelete()
    }
  }, [api])

  const replaceDownloads = useCallback((next: Download[]) => {
    setDownloads(next)
    setError(null)
  }, [])

  const signature = downloads.map((download) => download.status).join('|')
  const meta = useMemo<DownloadsMeta>(() => {
    const counts: DownloadCounts = { queue: 0, completed: 0, cancelled: 0, failed: 0 }
    for (const download of downloads) {
      if (QUEUE_STATUSES.includes(download.status)) counts.queue += 1
      else if (download.status === 'completed') counts.completed += 1
      else if (download.status === 'cancelled') counts.cancelled += 1
      else if (download.status === 'failed') counts.failed += 1
    }
    return { loaded, error, counts }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity must only change when the status distribution changes
  }, [loaded, error, signature])

  const data = useMemo<DownloadsData>(
    () => ({ downloads, replaceDownloads }),
    [downloads, replaceDownloads]
  )

  return (
    <DownloadsDataContext.Provider value={data}>
      <DownloadsMetaContext.Provider value={meta}>{children}</DownloadsMetaContext.Provider>
    </DownloadsDataContext.Provider>
  )
}

export function useDownloadsData(): DownloadsData {
  const context = useContext(DownloadsDataContext)
  if (!context) {
    throw new Error('useDownloadsData must be used within a DownloadsStateProvider.')
  }
  return context
}

export function useDownloadMeta(): DownloadsMeta {
  const context = useContext(DownloadsMetaContext)
  if (!context) {
    throw new Error('useDownloadMeta must be used within a DownloadsStateProvider.')
  }
  return context
}

export function hasTerminalStatus(downloads: Download[]): boolean {
  return downloads.some((download) => TERMINAL_STATUSES.includes(download.status))
}

function applyState(
  previous: Download[],
  download: Download,
  tombstones: Set<string>
): Download[] {
  tombstones.delete(download.id)
  const index = previous.findIndex((item) => item.id === download.id)
  if (index === -1) {
    return [download, ...previous]
  }
  const next = [...previous]
  next[index] = download
  return next
}

function mergeSnapshot(
  snapshot: Download[],
  pending: Download[],
  tombstones: Set<string>
): Download[] {
  const byId = new Map<string, Download>()
  for (const download of snapshot) {
    if (!tombstones.has(download.id)) {
      byId.set(download.id, download)
    }
  }
  for (const download of pending) {
    tombstones.delete(download.id)
    byId.set(download.id, download)
  }
  return [...byId.values()]
}
