import { randomUUID } from 'node:crypto'
import type { Download, DownloadOptions } from '../../../shared/types/download'
import { AppError } from '../../utils/errors'

export interface DownloadManager {
  create(options: DownloadOptions): Promise<Download>
  start(id: string): Promise<Download>
  cancel(id: string): Promise<Download>
  get(id: string): Promise<Download>
  list(): Promise<Download[]>
}

export interface DownloadManagerOptions {
  now?: () => number
  generateId?: () => string
}

export function createDownloadManager(options: DownloadManagerOptions = {}): DownloadManager {
  const now = options.now ?? (() => Date.now())
  const generateId = options.generateId ?? (() => randomUUID())
  const jobs = new Map<string, Download>()

  function getOrThrow(id: string): Download {
    const download = jobs.get(id)
    if (!download) {
      throw new AppError('DownloadError', 'The download was not found.')
    }
    return download
  }

  function update(id: string, changes: Partial<Download>): Download {
    const download = getOrThrow(id)
    const updated: Download = { ...download, ...changes, updatedAt: now() }
    jobs.set(id, updated)
    return updated
  }

  return {
    async create(options: DownloadOptions): Promise<Download> {
      const download: Download = {
        id: generateId(),
        url: options.url,
        status: 'queued',
        progress: {},
        createdAt: now(),
        updatedAt: now()
      }
      jobs.set(download.id, download)
      return download
    },

    async start(id: string): Promise<Download> {
      const download = getOrThrow(id)
      if (download.status !== 'queued') {
        throw new AppError('DownloadError', `Cannot start a download in state "${download.status}".`)
      }
      throw new AppError(
        'NotImplementedError',
        'Downloads are not implemented yet in the application skeleton.'
      )
    },

    async cancel(id: string): Promise<Download> {
      const download = getOrThrow(id)
      if (download.status !== 'queued') {
        throw new AppError(
          'CancellationError',
          `Cannot cancel a download in state "${download.status}".`
        )
      }
      return update(id, { status: 'cancelled', progress: {} })
    },

    async get(id: string): Promise<Download> {
      return getOrThrow(id)
    },

    async list(): Promise<Download[]> {
      return [...jobs.values()]
    }
  }
}
