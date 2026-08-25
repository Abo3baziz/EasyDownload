import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Download, DownloadOptions, DownloadStatus } from '../../../shared/types/download'
import type { DependencyStatus } from '../../../shared/types/dependencies'
import { normalizeUrl } from '../../../shared/utils/url'
import { AppError, toAppError } from '../../utils/errors'
import type { HistoryManager } from '../history/history-manager'
import { buildResolution, isRealCodec } from '../media/normalize'
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
  pause(id: string): Promise<Download>
  resume(id: string): Promise<Download>
  cancel(id: string): Promise<Download>
  retry(id: string): Promise<Download>
  remove(id: string): Promise<Download | undefined>
  get(id: string): Promise<Download>
  list(): Promise<Download[]>
  clearHistory(): Promise<Download[]>
  onUpdate(listener: (download: Download) => void): () => void
  onDelete(listener: (download: Download) => void): () => void
}

export interface DownloadManagerOptions {
  ytDlp: YtDlpService
  checkFfmpeg?: () => Promise<Pick<DependencyStatus, 'available'>>
  history?: HistoryManager
  statFile?: (path: string) => Promise<{ size: number } | undefined>
  fileExists?: (path: string) => boolean
  listDirectory?: (path: string) => Promise<string[]>
  getConcurrencyLimit?: () => number | Promise<number>
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
  const activeIds = new Set<string>()
  const executionPromises = new Map<string, Promise<void>>()
  const handles = new Map<string, DownloadMediaHandle>()
  const mediaOptionsById = new Map<string, DownloadMediaOptions>()
  const mediaMetaById = new Map<string, { id: string; title: string; extension: string }>()
  const pauseRequests = new Set<string>()
  const cancelRequests = new Set<string>()
  const listeners = new Set<(download: Download) => void>()
  const deleteListeners = new Set<(download: Download) => void>()
  let scheduleChain: Promise<void> = Promise.resolve()
  let historyLoaded = false
  let loadingHistory: Promise<void> | undefined
  let persistChain: Promise<boolean> = Promise.resolve(true)

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
        .then(async (records) => {
          for (const record of records) {
            if (!jobs.has(record.id)) {
              jobs.set(record.id, record)
            }
          }
          await backfillMissingDestinations()
        })
        .catch(() => undefined)
        .finally(() => {
          historyLoaded = true
        })
    }
    return loadingHistory
  }

  function persistHistory(): Promise<boolean> {
    if (!options.history) {
      return Promise.resolve(true)
    }
    const records = [...jobs.values()].filter((download) => isTerminal(download.status))
    persistChain = persistChain
      .catch(() => false)
      .then(() => options.history!.save(records))
      .then(() => true)
      .catch(() => false)
    return persistChain
  }

  function pruneMissingFiles(): void {
    if (!options.fileExists) {
      return
    }
    let removed = false
    for (const [id, download] of jobs) {
      if (download.status === 'completed' && download.destination) {
        if (!options.fileExists(download.destination)) {
          jobs.delete(id)
          configs.delete(id)
          removed = true
        }
      }
    }
    if (removed) {
      void persistHistory()
    }
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

  function emitDelete(download: Download): void {
    for (const listener of deleteListeners) {
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

  async function resolveConcurrencyLimit(): Promise<number> {
    if (!options.getConcurrencyLimit) {
      return 1
    }
    try {
      const limit = await options.getConcurrencyLimit()
      return Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1
    } catch {
      return 1
    }
  }

  function schedule(): void {
    scheduleChain = scheduleChain.then(executeNext).catch(() => undefined)
  }

  async function executeNext(): Promise<void> {
    const limit = await resolveConcurrencyLimit()
    while (queue.length > 0 && activeIds.size < limit) {
      const id = queue.shift() as string
      if (activeIds.has(id)) {
        queue.unshift(id)
        break
      }
      activeIds.add(id)
      const execution = execute(id).catch(() => undefined)
      executionPromises.set(id, execution)
      void execution.finally(() => {
        executionPromises.delete(id)
        activeIds.delete(id)
        schedule()
      })
    }
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

    let mediaOptions = mediaOptionsById.get(id)
    if (!mediaOptions) {
      update(id, { status: 'inspecting', progress: {}, error: undefined })
      try {
        const media = await options.ytDlp.inspect(config.url)
        if (cancelRequests.has(id)) {
          await finishCancelled(id)
          return
        }
        if (pauseRequests.has(id)) {
          update(id, { status: 'paused' })
          return
        }
        mediaOptions = buildDownloadMediaOptions(config, media)
        mediaOptionsById.set(id, mediaOptions)
        const format = (media.formats ?? []).find(
          (candidate) => candidate.format_id === config.formatId
        )
        mediaMetaById.set(id, {
          id: media.id,
          title: media.title,
          extension: mediaOptions.mergeOutputFormat ?? format?.ext ?? 'mp4'
        })
        update(id, {
          title: media.title,
          thumbnail: media.thumbnail,
          duration: media.duration,
          ...formatMetadata(media, config.formatId),
          status: 'downloading'
        })
      } catch (err) {
        if (cancelRequests.has(id)) {
          await finishCancelled(id)
        } else if (!pauseRequests.has(id)) {
          update(id, { status: 'failed', error: toAppError(err).toPayload() })
        }
        return
      }
    } else {
      update(id, { status: 'downloading', error: undefined })
    }

    if (cancelRequests.has(id) || pauseRequests.has(id)) return

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
        if (cancelRequests.has(id) || pauseRequests.has(id)) return
        update(id, { progress, status: 'downloading' })
      },
      onPhase: (phase) => {
        if (cancelRequests.has(id) || pauseRequests.has(id)) return
        update(id, { status: phase === 'processing' ? 'processing' : 'downloading' })
      }
    })
    handles.set(id, handle)

    try {
      const result = await handle.result
      if (result.cancelled || cancelRequests.has(id)) {
        await finishCancelled(id, result.destination)
      } else if (result.paused || pauseRequests.has(id)) {
        pauseRequests.delete(id)
        if (result.destination) {
          update(id, { destination: result.destination })
        }
      } else if (result.exitCode === 0) {
        const destination = result.destination ?? deriveCompletedDestination(id)
        const fileSize = await readFileSize(destination)
        update(id, {
          status: 'completed',
          progress: { percent: 100 },
          fileName: destination ? basename(destination) : undefined,
          destination,
          fileSize
        })
      } else {
        update(id, { status: 'failed', error: toDownloadError(result).toPayload() })
      }
    } catch (err) {
      if (cancelRequests.has(id)) {
        await finishCancelled(id)
      } else if (pauseRequests.has(id)) {
        pauseRequests.delete(id)
      } else {
        update(id, { status: 'failed', error: toAppError(err).toPayload() })
      }
    } finally {
      handles.delete(id)
    }
  }

  async function finishCancelled(id: string, destination?: string): Promise<void> {
    await cleanupFiles(destination)
    const status = getOrThrow(id).status
    if (status !== 'cancelled' && !isTerminal(status) && status !== 'queued') {
      update(id, { status: 'cancelled', progress: {} })
    }
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

  function deriveCompletedDestination(id: string): string | undefined {
    const meta = mediaMetaById.get(id)
    const config = configs.get(id)
    if (!meta || !config || !options.fileExists) {
      return undefined
    }
    const candidate = join(
      config.directory,
      `${meta.title} [${meta.id}] [${config.formatId}].${meta.extension}`
    )
    return options.fileExists(candidate) ? candidate : undefined
  }

  async function backfillMissingDestinations(): Promise<void> {
    if (!options.listDirectory || !options.fileExists) {
      return
    }
    let changed = false
    for (const download of jobs.values()) {
      if (download.status !== 'completed' || download.destination) {
        continue
      }
      if (!download.directory || !download.title || !download.formatId || !download.extension) {
        continue
      }
      const match = await findMatchingFile(
        download.directory,
        download.title,
        download.formatId,
        download.extension
      )
      if (!match) {
        continue
      }
      const destination = join(download.directory, match.fileName)
      if (!options.fileExists(destination)) {
        continue
      }
      jobs.set(download.id, {
        ...download,
        destination,
        fileName: match.fileName,
        fileSize: match.fileSize
      })
      changed = true
    }
    if (changed) {
      void persistHistory()
    }
  }

  async function findMatchingFile(
    directory: string,
    title: string,
    formatId: string,
    extension: string
  ): Promise<{ fileName: string; fileSize?: number } | undefined> {
    let names: string[]
    try {
      names = await options.listDirectory!(directory)
    } catch {
      return undefined
    }
    const pattern = new RegExp(
      `^${escapeRegExp(title)} \\[[^\\]]+\\] \\[${escapeRegExp(formatId)}\\]\\.${escapeRegExp(extension)}$`
    )
    const matches = names.filter((name) => pattern.test(name))
    if (matches.length !== 1) {
      return undefined
    }
    const fileName = matches[0]!
    const fileSize = await readFileSize(join(directory, fileName))
    return { fileName, fileSize }
  }

  function configFromDownload(download: Download): DownloadOptions {
    if (!download.formatId || !download.directory) {
      throw new AppError('DownloadError', 'The original download configuration is missing.')
    }
    return { url: download.url, formatId: download.formatId, directory: download.directory }
  }

  return {
    async create(optionsPayload: DownloadOptions): Promise<Download> {
      await ensureLoaded()
      pruneMissingFiles()
      const alreadyDownloaded = [...jobs.values()].some(
        (download) =>
          download.status === 'completed' &&
          download.formatId === optionsPayload.formatId &&
          normalizeUrl(download.url) === normalizeUrl(optionsPayload.url)
      )
      if (alreadyDownloaded) {
        throw new AppError(
          'DownloadError',
          'This video has already been downloaded in this format.'
        )
      }
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
      schedule()
      return getOrThrow(id)
    },

    async pause(id: string): Promise<Download> {
      await ensureLoaded()
      const download = getOrThrow(id)
      if (!ACTIVE_STATUSES.includes(download.status)) {
        throw new AppError('DownloadError', `Cannot pause a download in state "${download.status}".`)
      }
      pauseRequests.add(id)
      handles.get(id)?.pause?.()
      return update(id, { status: 'paused' })
    },

    async resume(id: string): Promise<Download> {
      await ensureLoaded()
      const download = getOrThrow(id)
      if (download.status !== 'paused') {
        throw new AppError('DownloadError', `Cannot resume a download in state "${download.status}".`)
      }
      pauseRequests.delete(id)
      cancelRequests.delete(id)
      const existingOptions = mediaOptionsById.get(id)
      if (existingOptions) {
        mediaOptionsById.set(id, { ...existingOptions, resume: true })
      }
      update(id, { status: 'queued', error: undefined })
      if (!queue.includes(id)) {
        queue.push(id)
      }
      schedule()
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
      if (download.status === 'paused') {
        cancelRequests.add(id)
        pauseRequests.delete(id)
        await finishCancelled(id, download.destination)
        return getOrThrow(id)
      }
      if (ACTIVE_STATUSES.includes(download.status)) {
        cancelRequests.add(id)
        pauseRequests.delete(id)
        const handle = handles.get(id)
        if (handle) {
          handle.cancel()
        }
        return update(id, { status: 'cancelled', progress: {} })
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
      cancelRequests.delete(id)
      pauseRequests.delete(id)
      mediaOptionsById.delete(id)
      mediaMetaById.delete(id)
      update(id, { status: 'queued', progress: {}, error: undefined })
      if (!queue.includes(id)) {
        queue.push(id)
      }
      void persistHistory()
      schedule()
      return getOrThrow(id)
    },

    async remove(id: string): Promise<Download | undefined> {
      await ensureLoaded()
      let download = jobs.get(id)
      if (!download) {
        return undefined
      }
      if (!isTerminal(download.status)) {
        throw new AppError(
          'DownloadError',
          `Cannot delete a download in state "${download.status}".`
        )
      }

      const execution = executionPromises.get(id)
      if (execution) {
        await execution
        download = jobs.get(id)
        if (!download) {
          return undefined
        }
        if (!isTerminal(download.status)) {
          throw new AppError(
            'DownloadError',
            `Cannot delete a download in state "${download.status}".`
          )
        }
      }

      const config = configs.get(id)
      const mediaOptions = mediaOptionsById.get(id)
      const wasPaused = pauseRequests.delete(id)
      const wasCancelled = cancelRequests.delete(id)
      const queueIndex = queue.indexOf(id)

      jobs.delete(id)
      configs.delete(id)
      mediaOptionsById.delete(id)
      mediaMetaById.delete(id)
      handles.delete(id)
      if (queueIndex >= 0) {
        queue.splice(queueIndex, 1)
      }

      if (!(await persistHistory())) {
        jobs.set(id, download)
        if (config) {
          configs.set(id, config)
        }
        if (mediaOptions) {
          mediaOptionsById.set(id, mediaOptions)
        }
        if (wasPaused) {
          pauseRequests.add(id)
        }
        if (wasCancelled) {
          cancelRequests.add(id)
        }
        if (queueIndex >= 0) {
          queue.splice(queueIndex, 0, id)
        }
        throw new AppError('FilesystemError', 'Failed to delete the download history entry.')
      }

      emitDelete(download)
      return download
    },

    async get(id: string): Promise<Download> {
      await ensureLoaded()
      return getOrThrow(id)
    },

    async list(): Promise<Download[]> {
      await ensureLoaded()
      pruneMissingFiles()
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
    },

    onDelete(listener: (download: Download) => void): () => void {
      deleteListeners.add(listener)
      return () => {
        deleteListeners.delete(listener)
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

function formatMetadata(
  media: YtDlpMedia,
  formatId: string
): Pick<
  Download,
  'resolution' | 'extension' | 'videoCodec' | 'audioCodec' | 'fps'
> {
  const format = (media.formats ?? []).find(
    (candidate) => candidate.format_id === formatId
  )
  if (!format) {
    return {
      resolution: undefined,
      extension: undefined,
      videoCodec: undefined,
      audioCodec: undefined,
      fps: undefined
    }
  }
  return {
    resolution: buildResolution(format),
    extension: format.ext,
    videoCodec: isRealCodec(format.vcodec) ? format.vcodec : undefined,
    audioCodec: isRealCodec(format.acodec) ? format.acodec : undefined,
    fps: format.fps
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
