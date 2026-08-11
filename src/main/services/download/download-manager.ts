import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Download, DownloadOptions } from '../../../shared/types/download'
import type { DependencyStatus } from '../../../shared/types/dependencies'
import { AppError, toAppError } from '../../utils/errors'
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
  onUpdate(listener: (download: Download) => void): () => void
}

export interface DownloadManagerOptions {
  ytDlp: YtDlpService
  checkFfmpeg?: () => Promise<Pick<DependencyStatus, 'available'>>
  now?: () => number
  generateId?: () => string
}

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
    emit(updated)
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
        update(id, {
          status: 'completed',
          progress: { percent: 100 },
          fileName: result.destination ? basename(result.destination) : undefined,
          destination: result.destination
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

  return {
    async create(optionsPayload: DownloadOptions): Promise<Download> {
      const download: Download = {
        id: generateId(),
        url: optionsPayload.url,
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
      const download = getOrThrow(id)
      if (download.status !== 'failed' && download.status !== 'cancelled') {
        throw new AppError(
          'DownloadError',
          `Cannot retry a download in state "${download.status}".`
        )
      }
      if (!configs.has(id)) {
        throw new AppError('DownloadError', 'The original download configuration is missing.')
      }
      update(id, { status: 'queued', progress: {}, error: undefined })
      queue.push(id)
      if (!activeId) {
        schedule()
      }
      return getOrThrow(id)
    },

    async get(id: string): Promise<Download> {
      return getOrThrow(id)
    },

    async list(): Promise<Download[]> {
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
