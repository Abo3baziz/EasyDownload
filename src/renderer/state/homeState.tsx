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
import type { MediaInfo } from '../../shared/types/media'
import { normalizeUrl } from '../../shared/utils/url'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export interface HomeState {
  url: string
  setUrl: (url: string) => void
  clearUrl: () => void
  getInspection: (url: string) => MediaInfo | undefined
  setInspection: (url: string, media: MediaInfo) => void
  isDownloading: (url: string, formatId: string) => boolean
  markDownloading: (url: string, formatId: string) => boolean
  unmarkDownloading: (url: string, formatId: string) => void
}

const IN_PROGRESS_STATUSES: DownloadStatus[] = ['queued', 'inspecting', 'downloading', 'processing']
const TERMINAL_STATUSES: DownloadStatus[] = ['completed', 'failed', 'cancelled']

const HomeStateContext = createContext<HomeState | null>(null)

function downloadKey(url: string, formatId: string): string {
  return `${normalizeUrl(url)}::${formatId}`
}

export function HomeStateProvider({ children }: { children: ReactNode }) {
  const api = useMediaDownloader()
  const [url, setUrlState] = useState('')
  const [inspections, setInspections] = useState<Record<string, MediaInfo>>({})
  const [downloadingKeys, setDownloadingKeys] = useState<ReadonlySet<string>>(new Set())
  const downloadingRef = useRef<Set<string>>(new Set())

  const applyDownload = useCallback((download: Download) => {
    if (!download.formatId) {
      return
    }
    const key = downloadKey(download.url, download.formatId)
    if (IN_PROGRESS_STATUSES.includes(download.status)) {
      downloadingRef.current.add(key)
    } else if (TERMINAL_STATUSES.includes(download.status)) {
      downloadingRef.current.delete(key)
    } else {
      return
    }
    setDownloadingKeys(new Set(downloadingRef.current))
  }, [])

  useEffect(() => {
    return api.onDownloadStateChange(applyDownload)
  }, [api, applyDownload])

  const setUrl = useCallback((next: string) => setUrlState(next), [])
  const clearUrl = useCallback(() => setUrlState(''), [])
  const setInspection = useCallback((inspectedUrl: string, media: MediaInfo) => {
    setInspections((previous) => ({ ...previous, [normalizeUrl(inspectedUrl)]: media }))
  }, [])
  const getInspection = useCallback(
    (candidate: string) => inspections[normalizeUrl(candidate)],
    [inspections]
  )
  const isDownloading = useCallback(
    (candidateUrl: string, formatId: string) =>
      downloadingKeys.has(downloadKey(candidateUrl, formatId)),
    [downloadingKeys]
  )
  const markDownloading = useCallback((candidateUrl: string, formatId: string) => {
    const key = downloadKey(candidateUrl, formatId)
    if (downloadingRef.current.has(key)) {
      return false
    }
    downloadingRef.current.add(key)
    setDownloadingKeys(new Set(downloadingRef.current))
    return true
  }, [])
  const unmarkDownloading = useCallback((candidateUrl: string, formatId: string) => {
    downloadingRef.current.delete(downloadKey(candidateUrl, formatId))
    setDownloadingKeys(new Set(downloadingRef.current))
  }, [])

  const value = useMemo<HomeState>(
    () => ({
      url,
      setUrl,
      clearUrl,
      getInspection,
      setInspection,
      isDownloading,
      markDownloading,
      unmarkDownloading
    }),
    [
      url,
      setUrl,
      clearUrl,
      getInspection,
      setInspection,
      isDownloading,
      markDownloading,
      unmarkDownloading
    ]
  )

  return <HomeStateContext.Provider value={value}>{children}</HomeStateContext.Provider>
}

export function useHomeState(): HomeState {
  const context = useContext(HomeStateContext)
  if (!context) {
    throw new Error('useHomeState must be used within a HomeStateProvider.')
  }
  return context
}
