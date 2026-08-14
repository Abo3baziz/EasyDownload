import { randomUUID } from 'node:crypto'
import { normalizeUrl } from '../../../shared/utils/url'
import type { HistoryEntry } from '../../../shared/types/history'
import type { JsonStore } from './json-store'

export interface InspectionHistoryManager {
  list(): Promise<HistoryEntry[]>
  add(input: { url: string; thumbnail?: string }): Promise<HistoryEntry | null>
  remove(id: string): Promise<boolean>
  onUpdate(listener: (entry: HistoryEntry) => void): () => void
  onDelete(listener: (entry: HistoryEntry) => void): () => void
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
  const deleteListeners = new Set<(entry: HistoryEntry) => void>()
  let historyLoaded = false
  let loadingHistory: Promise<void> | undefined

  function emit(entry: HistoryEntry): void {
    for (const listener of listeners) {
      listener(entry)
    }
  }

  function emitDelete(entry: HistoryEntry): void {
    for (const listener of deleteListeners) {
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
          const newestByUrl = new Map<string, HistoryEntry>()
          for (const record of records) {
            const key = normalizeUrl(record.url)
            const current = newestByUrl.get(key)
            if (!current || record.createdAt >= current.createdAt) {
              newestByUrl.set(key, record)
            }
          }
          for (const record of newestByUrl.values()) {
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

  async function persist(): Promise<boolean> {
    if (!options.history) {
      return true
    }
    try {
      await options.history.save([...entries.values()])
      return true
    } catch (err) {
      console.error('[inspectionHistory] Failed to save history entries.', err)
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
      const existing = [...entries.values()].find(
        (entry) => normalizeUrl(entry.url) === normalizeUrl(input.url)
      )
      if (existing) {
        const updated: HistoryEntry = {
          ...existing,
          url: input.url,
          thumbnail: input.thumbnail,
          createdAt: now()
        }
        entries.set(updated.id, updated)
        const saved = await persist()
        if (!saved) {
          entries.set(existing.id, existing)
          return null
        }
        emit(updated)
        return updated
      }
      const entry: HistoryEntry = {
        id: generateId(),
        url: input.url,
        thumbnail: input.thumbnail,
        operation: 'INSPECTED',
        createdAt: now()
      }
      entries.set(entry.id, entry)
      const saved = await persist()
      if (!saved) {
        entries.delete(entry.id)
        return null
      }
      emit(entry)
      return entry
    },

    async remove(id: string): Promise<boolean> {
      await ensureLoaded()
      const entry = entries.get(id)
      if (!entry) {
        return false
      }
      entries.delete(id)
      const saved = await persist()
      if (!saved) {
        entries.set(id, entry)
        return false
      }
      emitDelete(entry)
      return true
    },

    onUpdate(listener: (entry: HistoryEntry) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    onDelete(listener: (entry: HistoryEntry) => void): () => void {
      deleteListeners.add(listener)
      return () => {
        deleteListeners.delete(listener)
      }
    }
  }
}
