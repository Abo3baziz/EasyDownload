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
import type { InspectionResult } from '../../shared/types/media'
import { normalizeUrl } from '../../shared/utils/url'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export interface HomeState {
  url: string
  setUrl: (url: string) => void
  clearUrl: () => void
  getInspection: (url: string) => InspectionResult | undefined
  setInspection: (url: string, result: InspectionResult) => void
  isDownloading: (url: string, formatId: string) => boolean
  markDownloading: (url: string, formatId: string) => boolean
  unmarkDownloading: (url: string, formatId: string) => void
  isPlaylistActive: (playlistId: string) => boolean
  markPlaylistDownloading: (playlistId: string) => boolean
  unmarkPlaylistDownloading: (playlistId: string) => void
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
  const [inspections, setInspections] = useState<Record<string, InspectionResult>>({})
  const [downloadingKeys, setDownloadingKeys] = useState<ReadonlySet<string>>(new Set())
  const downloadingRef = useRef<Set<string>>(new Set())
  const [activePlaylists, setActivePlaylists] = useState<ReadonlySet<string>>(new Set())
  const activePlaylistEntries = useRef<Map<string, Set<string>>>(new Map())
  const playlistGuard = useRef<Set<string>>(new Set())

  const applyDownload = useCallback((download: Download) => {
    if (download.playlistId) {
      const entries = activePlaylistEntries.current
      const ids = entries.get(download.playlistId) ?? new Set<string>()
      if (IN_PROGRESS_STATUSES.includes(download.status)) {
        ids.add(download.id)
      } else if (TERMINAL_STATUSES.includes(download.status)) {
        ids.delete(download.id)
      }
      if (ids.size === 0) {
        entries.delete(download.playlistId)
        playlistGuard.current.delete(download.playlistId)
      } else {
        entries.set(download.playlistId, ids)
      }
      setActivePlaylists(new Set(entries.keys()))
    }
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
  const setInspection = useCallback((inspectedUrl: string, result: InspectionResult) => {
    setInspections((previous) => ({ ...previous, [normalizeUrl(inspectedUrl)]: result }))
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
  const isPlaylistActive = useCallback(
    (playlistId: string) =>
      playlistGuard.current.has(playlistId) || activePlaylists.has(playlistId),
    [activePlaylists]
  )
  const markPlaylistDownloading = useCallback((playlistId: string) => {
    if (playlistGuard.current.has(playlistId)) {
      return false
    }
    playlistGuard.current.add(playlistId)
    return true
  }, [])
  const unmarkPlaylistDownloading = useCallback((playlistId: string) => {
    playlistGuard.current.delete(playlistId)
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
      unmarkDownloading,
      isPlaylistActive,
      markPlaylistDownloading,
      unmarkPlaylistDownloading
    }),
    [
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
