import type { Download } from '../../../shared/types/download'
import type { JsonStore } from './json-store'
import { createJsonStore } from './json-store'

export interface HistoryManager {
  load(): Promise<Download[]>
  save(downloads: Download[]): Promise<void>
}

export interface HistoryManagerOptions {
  dir: string
  fileName?: string
}

export function createHistoryManager(options: HistoryManagerOptions): HistoryManager {
  const store: JsonStore<Download> = createJsonStore({
    dir: options.dir,
    fileName: options.fileName ?? 'history.json'
  })
  return {
    load: () => store.load(),
    save: (downloads) => store.save(downloads)
  }
}
