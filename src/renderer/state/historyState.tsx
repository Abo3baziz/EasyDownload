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
import type { AppError } from '../../shared/types/errors'
import type { HistoryEntry } from '../../shared/types/history'
import type { IpcResult } from '../../shared/types/ipc'
import { useMediaDownloader } from '../hooks/useMediaDownloader'

export interface HistoryState {
  entries: HistoryEntry[]
  loaded: boolean
  error: AppError | null
  deleteEntry: (id: string) => Promise<IpcResult<boolean>>
}

const HistoryStateContext = createContext<HistoryState | null>(null)

export function HistoryStateProvider({ children }: { children: ReactNode }) {
  const api = useMediaDownloader()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const pendingRef = useRef<HistoryEntry[]>([])
  const loadedRef = useRef(false)
  const entriesRef = useRef<HistoryEntry[]>([])
  const deletedIdsRef = useRef<Set<string>>(new Set())

  function commitEntries(next: HistoryEntry[]): void {
    entriesRef.current = next
    setEntries(next)
  }

  useEffect(() => {
    let cancelled = false
    const unsubscribe = api.onInspectionHistoryChange((entry) => {
      if (!loadedRef.current) {
        pendingRef.current.push(entry)
      }
      commitEntries(mergeHistory([...entriesRef.current, entry]))
    })
    const unsubscribeDelete = api.onInspectionHistoryDeleted((entry) => {
      pendingRef.current = pendingRef.current.filter((item) => item.id !== entry.id)
      deletedIdsRef.current.delete(entry.id)
      commitEntries(entriesRef.current.filter((item) => item.id !== entry.id))
    })

    void (async () => {
      const result = await api.listInspectionHistory()
      if (cancelled) return
      if (result.ok) {
        const pending = pendingRef.current
        pendingRef.current = []
        commitEntries(mergeHistory([...pending, ...result.data]))
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
      unsubscribeDelete()
    }
  }, [api])

  const deleteEntry = useCallback(
    async (id: string): Promise<IpcResult<boolean>> => {
      if (deletedIdsRef.current.has(id)) {
        return { ok: true, data: true }
      }
      const removed = entriesRef.current.find((item) => item.id === id)
      if (!removed) {
        return { ok: true, data: true }
      }
      deletedIdsRef.current.add(id)
      commitEntries(entriesRef.current.filter((item) => item.id !== id))
      try {
        const result = await api.deleteInspectionHistoryEntry(id)
        if (!result.ok) {
          commitEntries(mergeHistory([...entriesRef.current, removed]))
        }
        return result
      } finally {
        deletedIdsRef.current.delete(id)
      }
    },
    [api]
  )

  const value = useMemo<HistoryState>(
    () => ({ entries, loaded, error, deleteEntry }),
    [entries, loaded, error, deleteEntry]
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
  const byId = new Map<string, HistoryEntry>()
  for (const entry of entries) {
    byId.set(entry.id, entry)
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
}
