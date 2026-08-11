import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Download, DownloadOptions, DownloadStatus } from '../../../shared/types/download'
import type { DependencyStatus } from '../../../shared/types/dependencies'
import { AppError, toAppError } from '../../utils/errors'
import type { HistoryManager } from '../history/history-manager'
import { isRealCodec } from '../media/normalize'
import type {
  DownloadMediaHandle,
  DownloadMediaOptions,
  YtDlpService
} from '../ytdlp/ytdlp-service'
import { toDownloadError } from '../ytdlp/ytdlp-service'
import type { YtDlpMedia } from '../ytdlp/types'

export interface DownloadManager {
  create(options: DownloadOptions): Promise<Download>
  start(id: string): Promise<Download>
  cancel(id: string): Promise<Download>
  retry(id: string): Promise<Download>
  get(id: string): Promise<Download>
  list(): Promise<Download[]>
  clearHistory(): Promise<Download[]>
  onUpdate(listener: (download: Download) => void): () => void
}

export interface DownloadManagerOptions {
  ytDlp: YtDlpService
  checkFfmpeg?: () => Promise<Pick<DependencyStatus, 'available'>>
  history?: HistoryManager
  statFile?: (path: string) => Promise<{ size: number } | undefined>
  now?: () => number
  generateId?: () => string
}

const TERMINAL_STATUSES: DownloadStatus[] = ['completed', 'failed', 'cancelled']

const ACTIVE_STATUSES: Download['status'][] = ['inspecting', 'downloading', 'processing']

export function createDownloadManager(options: DownloadManagerOptions): DownloadManager {
  const now = options.now ?? (() => Date.now())
  const generateId = options.generateId ?? (() => randomUUID())
  const jobs = new Map<string, Download>()
  const configs = new Map<string, DownloadOptions>()
  const queue: string[] = []
  const handles = new Map<string, DownloadMediaHandle>()
  const cancelRequests = new Set<string>()
  const listeners = new Set<(download: Download) => void>()
  let activeId: string | undefined
  let historyLoaded = false
  let loadingHistory: Promise<void> | undefined
  let persistChain: Promise<void> = Promise.resolve()

  function getOrThrow(id: string): Download {
    const download = jobs.get(id)
    if (!download) {
      throw new AppError('DownloadError', 'The download was not found.')
    }
    return download
  }

  function isTerminal(status: DownloadStatus): boolean {
    return TERMINAL_STATUSES.includes(status)
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
            if (!jobs.has(record.id)) {
              jobs.set(record.id, record)
            }
          }
        })
        .catch(() => undefined)
        .finally(() => {
          historyLoaded = true
        })
    }
    return loadingHistory
  }

  function persistHistory(): Promise<void> {
    if (!options.history) {
      return Promise.resolve()
    }
    const records = [...jobs.values()].filter((download) => isTerminal(download.status))
    persistChain = persistChain
      .catch(() => undefined)
      .then(() => options.history?.save(records))
      .catch(() => undefined)
    return persistChain
  }

  function update(id: string, changes: Partial<Download>): Download {
    const download = getOrThrow(id)
    const updated: Download = { ...download, ...changes, updatedAt: now() }
    jobs.set(id, updated)
    emit(updated)
    if (isTerminal(updated.status)) {
      void persistHistory()
    }
    return updated
  }

  function emit(download: Download): void {
    for (const listener of listeners) {
      listener(download)
    }
  }

  async function cleanupFiles(destination: string | undefined): Promise<void> {
    if (!destination) {
      return
    }
    for (const candidate of [destination, `${destination}.part`, `${destination}.ytdl`]) {
      try {
        await unlink(candidate)
      } catch {
        // Best-effort cleanup; a missing file is not an error.
      }
    }
  }

  async function executeNext(): Promise<void> {
    if (activeId || queue.length === 0) {
      return
    }
    const id = queue.shift() as string
    activeId = id
    await execute(id)
    activeId = undefined
    await executeNext()
  }

  function schedule(): void {
    void executeNext().catch(() => undefined)
  }

  async function execute(id: string): Promise<void> {
    const config = configs.get(id)
    if (!config) {
      update(id, {
        status: 'failed',
        error: { code: 'DownloadError', message: 'The download configuration is missing.' }
      })
      return
    }

    update(id, { status: 'inspecting', progress: {}, error: undefined })

    let mediaOptions: DownloadMediaOptions
    try {
      const media = await options.ytDlp.inspect(config.url)
      if (cancelRequests.has(id)) {
        finishCancelled(id)
        return
      }
      mediaOptions = buildDownloadMediaOptions(config, media)
      update(id, { title: media.title, status: 'downloading' })
    } catch (err) {
      if (cancelRequests.has(id)) {
        finishCancelled(id)
        return
      }
      update(id, { status: 'failed', error: toAppError(err).toPayload() })
      return
    }

    if (mediaOptions.mergeAudio && options.checkFfmpeg) {
      let ffmpegAvailable = false
      try {
        const ffmpeg = await options.checkFfmpeg()
        ffmpegAvailable = ffmpeg.available
      } catch {
        ffmpegAvailable = false
      }
      if (!ffmpegAvailable) {
        update(id, {
          status: 'failed',
          error: new AppError(
            'DependencyError',
            'FFmpeg is required to merge audio into this format, but it is not available.'
          ).toPayload()
        })
        return
      }
    }

    const handle = options.ytDlp.startDownload(mediaOptions, {
      onProgress: (progress) => {
        if (cancelRequests.has(id)) return
        update(id, { progress, status: 'downloading' })
      },
      onPhase: (phase) => {
        if (cancelRequests.has(id)) return
        update(id, { status: phase === 'processing' ? 'processing' : 'downloading' })
      }
    })
    handles.set(id, handle)

    try {
      const result = await handle.result
      if (result.cancelled || cancelRequests.has(id)) {
        finishCancelled(id, result.destination)
      } else if (result.exitCode === 0) {
        const fileSize = await readFileSize(result.destination)
        update(id, {
          status: 'completed',
          progress: { percent: 100 },
          fileName: result.destination ? basename(result.destination) : undefined,
          destination: result.destination,
          fileSize
        })
      } else {
        update(id, { status: 'failed', error: toDownloadError(result).toPayload() })
      }
    } catch (err) {
      if (cancelRequests.has(id)) {
        finishCancelled(id)
      } else {
        update(id, { status: 'failed', error: toAppError(err).toPayload() })
      }
    } finally {
      handles.delete(id)
    }
  }

  async function finishCancelled(id: string, destination?: string): Promise<void> {
    await cleanupFiles(destination)
    update(id, { status: 'cancelled', progress: {} })
  }

  async function readFileSize(path: string | undefined): Promise<number | undefined> {
    if (!path || !options.statFile) {
      return undefined
    }
    try {
      return (await options.statFile(path))?.size
    } catch {
      return undefined
    }
  }

  function configFromDownload(download: Download): DownloadOptions {
    if (!download.formatId || !download.directory) {
      throw new AppError('DownloadError', 'The original download configuration is missing.')
    }
    return { url: download.url, formatId: download.formatId, directory: download.directory }
  }

  return {
    async create(optionsPayload: DownloadOptions): Promise<Download> {
      const download: Download = {
        id: generateId(),
        url: optionsPayload.url,
        formatId: optionsPayload.formatId,
        status: 'queued',
        progress: {},
        directory: optionsPayload.directory,
        createdAt: now(),
        updatedAt: now()
      }
      jobs.set(download.id, download)
      configs.set(download.id, optionsPayload)
      queue.push(download.id)
      emit(download)
      return download
    },

    async start(id: string): Promise<Download> {
      await ensureLoaded()
      const download = getOrThrow(id)
      if (download.status !== 'queued') {
        throw new AppError('DownloadError', `Cannot start a download in state "${download.status}".`)
      }
      if (!queue.includes(id)) {
        queue.push(id)
      }
      if (!activeId) {
        schedule()
      }
      return getOrThrow(id)
    },

    async cancel(id: string): Promise<Download> {
      await ensureLoaded()
      const download = getOrThrow(id)
      if (download.status === 'queued') {
        const index = queue.indexOf(id)
        if (index >= 0) {
          queue.splice(index, 1)
        }
        return update(id, { status: 'cancelled', progress: {} })
      }
      if (ACTIVE_STATUSES.includes(download.status)) {
        cancelRequests.add(id)
        const handle = handles.get(id)
        if (handle) {
          handle.cancel()
        }
        return getOrThrow(id)
      }
      throw new AppError(
        'CancellationError',
        `Cannot cancel a download in state "${download.status}".`
      )
    },

    async retry(id: string): Promise<Download> {
      await ensureLoaded()
      const download = getOrThrow(id)
      if (download.status !== 'failed' && download.status !== 'cancelled') {
        throw new AppError(
          'DownloadError',
          `Cannot retry a download in state "${download.status}".`
        )
      }
      const config = configs.get(id) ?? configFromDownload(download)
      configs.set(id, config)
      update(id, { status: 'queued', progress: {}, error: undefined })
      queue.push(id)
      void persistHistory()
      if (!activeId) {
        schedule()
      }
      return getOrThrow(id)
    },

    async get(id: string): Promise<Download> {
      await ensureLoaded()
      return getOrThrow(id)
    },

    async list(): Promise<Download[]> {
      await ensureLoaded()
      return [...jobs.values()]
    },

    async clearHistory(): Promise<Download[]> {
      await ensureLoaded()
      for (const [id, download] of jobs) {
        if (isTerminal(download.status)) {
          jobs.delete(id)
        }
      }
      await persistHistory()
      return [...jobs.values()]
    },

    onUpdate(listener: (download: Download) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

function buildDownloadMediaOptions(
  config: DownloadOptions,
  media: YtDlpMedia
): DownloadMediaOptions {
  const optionsPayload: DownloadMediaOptions = {
    url: config.url,
    formatId: config.formatId,
    directory: config.directory
  }
  const format = (media.formats ?? []).find(
    (candidate) => candidate.format_id === config.formatId
  )
  if (format && isRealCodec(format.vcodec) && !isRealCodec(format.acodec)) {
    optionsPayload.mergeAudio = true
    if (format.ext) {
      optionsPayload.mergeOutputFormat = format.ext
    }
  }
  return optionsPayload
}
