import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { ReactNode } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { HistoryEntry } from '../../shared/types/history'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export interface HistoryState {
  entries: HistoryEntry[]
  loaded: boolean
  error: AppError | null
}

const HistoryStateContext = createContext<HistoryState | null>(null)

export function HistoryStateProvider({ children }: { children: ReactNode }) {
  const api = useMediaDownloader()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const pendingRef = useRef<HistoryEntry[]>([])
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = api.onInspectionHistoryChange((entry) => {
      if (!loadedRef.current) {
        pendingRef.current.push(entry)
      }
      setEntries((previous) => mergeHistory([...previous, entry]))
    })

    void (async () => {
      const result = await api.listInspectionHistory()
      if (cancelled) return
      if (result.ok) {
        const pending = pendingRef.current
        pendingRef.current = []
        setEntries(mergeHistory([...pending, ...result.data]))
      } else {
        setError(result.error)
      }
      if (!cancelled) {
        loadedRef.current = true
        setLoaded(true)
      }
    })()

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [api])

  const value = useMemo<HistoryState>(
    () => ({ entries, loaded, error }),
    [entries, loaded, error]
  )

  return <HistoryStateContext.Provider value={value}>{children}</HistoryStateContext.Provider>
}

export function useHistoryState(): HistoryState {
  const context = useContext(HistoryStateContext)
  if (!context) {
    throw new Error('useHistoryState must be used within a HistoryStateProvider.')
  }
  return context
}

function mergeHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>()
  const unique: HistoryEntry[] = []
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue
    }
    seen.add(entry.id)
    unique.push(entry)
  }
  return unique.sort((a, b) => b.createdAt - a.createdAt)
}
