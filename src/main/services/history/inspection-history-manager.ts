import { randomUUID } from 'node:crypto'
import type { HistoryEntry } from '../../../shared/types/history'
import type { JsonStore } from './json-store'

export interface InspectionHistoryManager {
  list(): Promise<HistoryEntry[]>
  add(input: { url: string; thumbnail?: string }): Promise<HistoryEntry | null>
  onUpdate(listener: (entry: HistoryEntry) => void): () => void
}

export interface InspectionHistoryManagerOptions {
  history?: JsonStore<HistoryEntry>
  now?: () => number
  generateId?: () => string
}

export function createInspectionHistoryManager(
  options: InspectionHistoryManagerOptions
): InspectionHistoryManager {
  const now = options.now ?? (() => Date.now())
  const generateId = options.generateId ?? (() => randomUUID())
  const entries = new Map<string, HistoryEntry>()
  const listeners = new Set<(entry: HistoryEntry) => void>()
  let historyLoaded = false
  let loadingHistory: Promise<void> | undefined

  function emit(entry: HistoryEntry): void {
    for (const listener of listeners) {
      listener(entry)
    }
  }

  function ensureLoaded(): Promise<void> {
    if (!options.history || historyLoaded) {
      return Promise.resolve()
    }
    if (!loadingHistory) {
      loadingHistory = options.history
        .load()
        .then((records) => {
          for (const record of records) {
            if (!entries.has(record.id)) {
              entries.set(record.id, record)
            }
          }
        })
        .catch((err) => {
          console.error('[inspectionHistory] Failed to load persisted entries.', err)
        })
        .finally(() => {
          historyLoaded = true
        })
    }
    return loadingHistory
  }

  async function saveEntry(entry: HistoryEntry): Promise<boolean> {
    if (!options.history) {
      return true
    }
    try {
      await options.history.save([...entries.values(), entry])
      return true
    } catch (err) {
      console.error('[inspectionHistory] Failed to save a history entry.', err)
      return false
    }
  }

  return {
    async list(): Promise<HistoryEntry[]> {
      await ensureLoaded()
      return [...entries.values()]
    },

    async add(input: { url: string; thumbnail?: string }): Promise<HistoryEntry | null> {
      await ensureLoaded()
      const entry: HistoryEntry = {
        id: generateId(),
        url: input.url,
        thumbnail: input.thumbnail,
        operation: 'INSPECTED',
        createdAt: now()
      }
      const saved = await saveEntry(entry)
      if (!saved) {
        return null
      }
      entries.set(entry.id, entry)
      emit(entry)
      return entry
    },

    onUpdate(listener: (entry: HistoryEntry) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
