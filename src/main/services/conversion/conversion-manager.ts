import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, join } from 'node:path'
import type { Conversion, ConversionStartOptions } from '../../../shared/types/conversion'
import { AppError, toAppError } from '../../utils/errors'
import type { FfmpegHandle, FfmpegService } from '../ffmpeg/ffmpeg-service'
import type { JsonStore } from '../history/json-store'

export interface ConversionManager {
  start(options: ConversionStartOptions): Promise<Conversion>
  cancel(id: string): Promise<Conversion>
  removeForInput(input: string): Promise<Conversion[]>
  list(): Promise<Conversion[]>
  clearHistory(): Promise<Conversion[]>
  shutdown(): Promise<void>
  onUpdate(listener: (conversion: Conversion) => void): () => void
}

export interface ConversionManagerOptions {
  ffmpeg: FfmpegService
  statFile?: (path: string) => Promise<{ size: number } | undefined>
  history?: JsonStore<Conversion>
  now?: () => number
  generateId?: () => string
  fileExists?: (path: string) => boolean
  deleteFile?: (path: string) => Promise<void>
}

export function createConversionManager(options: ConversionManagerOptions): ConversionManager {
  const now = options.now ?? (() => Date.now())
  const generateId = options.generateId ?? (() => randomUUID())
  const conversions = new Map<string, Conversion>()
  const handles = new Map<string, FfmpegHandle>()
  const runPromises = new Map<string, Promise<void>>()
  const listeners = new Set<(conversion: Conversion) => void>()
  let historyLoaded = false
  let loadingHistory: Promise<void> | undefined
  let persistChain: Promise<boolean> = Promise.resolve(true)

  function emit(conversion: Conversion): void {
    for (const listener of listeners) {
      listener(conversion)
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
            if (!conversions.has(record.id)) {
              conversions.set(record.id, record)
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

  function persistHistory(): Promise<boolean> {
    if (!options.history) {
      return Promise.resolve(true)
    }
    const records = [...conversions.values()].filter(
      (conversion) => conversion.type === 'extractAudio' && conversion.status === 'completed'
    )
    persistChain = persistChain
      .catch(() => false)
      .then(() => options.history!.save(records))
      .then(() => true)
      .catch(() => false)
    return persistChain
  }

  function update(id: string, changes: Partial<Conversion>): Conversion {
    const conversion = conversions.get(id)
    if (!conversion) {
      throw new AppError('DownloadError', 'The conversion was not found.')
    }
    const updated: Conversion = { ...conversion, ...changes, updatedAt: now() }
    conversions.set(id, updated)
    emit(updated)
    if (updated.status === 'completed' && updated.type === 'extractAudio') {
      void persistHistory()
    }
    return updated
  }

  function getOrThrow(id: string): Conversion {
    const conversion = conversions.get(id)
    if (!conversion) {
      throw new AppError('DownloadError', 'The conversion was not found.')
    }
    return conversion
  }

  async function readOutputFileSize(output: string): Promise<number | undefined> {
    if (!options.statFile) {
      return undefined
    }
    try {
      return (await options.statFile(output))?.size
    } catch {
      return undefined
    }
  }

  async function run(
    conversion: Conversion,
    input: string,
    startOptions: ConversionStartOptions
  ): Promise<void> {
    const handle =
      startOptions.type === 'convert'
        ? options.ffmpeg.convert(
            {
              input,
              output: conversion.output,
              overwrite: false,
              videoCodec: startOptions.videoCodec,
              audioCodec: startOptions.audioCodec
            },
            { onProgress: (progress) => update(conversion.id, { progress, status: 'running' }) }
          )
        : options.ffmpeg.extractAudio(
            {
              input,
              output: conversion.output,
              overwrite: false,
              audioCodec: startOptions.audioCodec
            },
            { onProgress: (progress) => update(conversion.id, { progress, status: 'running' }) }
          )
    handles.set(conversion.id, handle)

    try {
      const result = await handle.result
      if (result.cancelled) {
        await deletePartialOutput(conversion.output)
        update(conversion.id, { status: 'cancelled' })
      } else {
        const fileSize = await readOutputFileSize(conversion.output)
        update(conversion.id, {
          status: 'completed',
          progress: { processedMs: 0 },
          fileSize
        })
      }
    } catch (err) {
      await deletePartialOutput(conversion.output)
      update(conversion.id, { status: 'failed', error: toAppError(err).toPayload() })
    } finally {
      handles.delete(conversion.id)
    }
  }

  async function deletePartialOutput(output: string): Promise<void> {
    if (!options.deleteFile) {
      return
    }
    try {
      await options.deleteFile(output)
    } catch {
      // Best-effort cleanup; a missing file is not an error.
    }
  }

  async function resolveConversionOutputPath(
    input: string,
    startOptions: ConversionStartOptions
  ): Promise<string> {
    const candidate = buildConversionOutputPath(input, startOptions)
    if (!options.fileExists) {
      return candidate
    }
    let current = candidate
    let index = 1
    while (options.fileExists(current)) {
      index += 1
      current = withNumericSuffix(candidate, index)
    }
    return current
  }

  return {
    async start(startOptions: ConversionStartOptions): Promise<Conversion> {
      await ensureLoaded()
      if (options.statFile) {
        const info = await options.statFile(startOptions.input).catch(() => undefined)
        if (!info) {
          throw new AppError('FilesystemError', 'The source file does not exist.')
        }
      }
      const output = await resolveConversionOutputPath(startOptions.input, startOptions)
      const conversion: Conversion = {
        id: generateId(),
        type: startOptions.type,
        input: startOptions.input,
        output,
        status: 'running',
        progress: { processedMs: 0 },
        title: startOptions.title,
        thumbnail: startOptions.thumbnail,
        duration: startOptions.duration,
        createdAt: now(),
        updatedAt: now()
      }
      conversions.set(conversion.id, conversion)
      emit(conversion)
      const runPromise = run(conversion, startOptions.input, startOptions)
        .catch(() => undefined)
        .finally(() => {
          runPromises.delete(conversion.id)
        })
      runPromises.set(conversion.id, runPromise)
      return conversion
    },

    async cancel(id: string): Promise<Conversion> {
      await ensureLoaded()
      const conversion = getOrThrow(id)
      if (conversion.status !== 'running') {
        throw new AppError(
          'CancellationError',
          `Cannot cancel a conversion in state "${conversion.status}".`
        )
      }
      const handle = handles.get(id)
      if (handle) {
        handle.cancel()
      }
      return conversion
    },

    async removeForInput(input: string): Promise<Conversion[]> {
      await ensureLoaded()
      const removed = [...conversions.values()].filter((conversion) => conversion.input === input)
      if (removed.some((conversion) => conversion.status === 'running')) {
        throw new AppError('DownloadError', 'Cannot delete a download while a conversion is running.')
      }
      if (removed.length === 0) {
        return []
      }

      for (const conversion of removed) {
        conversions.delete(conversion.id)
      }

      if (!(await persistHistory())) {
        for (const conversion of removed) {
          conversions.set(conversion.id, conversion)
        }
        throw new AppError('FilesystemError', 'Failed to delete linked conversion history.')
      }

      return removed
    },

    async list(): Promise<Conversion[]> {
      await ensureLoaded()
      return [...conversions.values()]
    },

    async clearHistory(): Promise<Conversion[]> {
      await ensureLoaded()
      for (const [id, conversion] of conversions) {
        if (conversion.type === 'extractAudio' && conversion.status === 'completed') {
          conversions.delete(id)
        }
      }
      await persistHistory()
      return [...conversions.values()]
    },

    async shutdown(): Promise<void> {
      await ensureLoaded()
      for (const handle of handles.values()) {
        handle.cancel()
      }
      await Promise.allSettled([...runPromises.values()])
      await persistHistory()
    },

    onUpdate(listener: (conversion: Conversion) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

export function buildConversionOutputPath(
  input: string,
  options: Pick<ConversionStartOptions, 'type' | 'videoCodec' | 'audioCodec'>
): string {
  const extension = outputExtension(options)
  return buildPath(input, extension)
}

function outputExtension(
  options: Pick<ConversionStartOptions, 'type' | 'videoCodec' | 'audioCodec'>
): string {
  if (options.type === 'extractAudio') {
    switch (options.audioCodec ?? 'mp3') {
      case 'mp3':
        return 'mp3'
      case 'aac':
        return 'm4a'
      case 'opus':
        return 'opus'
      case 'flac':
        return 'flac'
      case 'vorbis':
        return 'ogg'
      case 'copy':
        return 'm4a'
    }
  }
  switch (options.videoCodec ?? 'copy') {
    case 'h264':
    case 'hevc':
      return 'mp4'
    case 'copy':
      return 'mkv'
  }
  return 'mp4'
}

function buildPath(input: string, extension: string): string {
  const dir = dirname(input)
  const base = basename(input, extname(input))
  const candidate = join(dir, `${base}.${extension}`)
  if (candidate.toLowerCase() === input.toLowerCase()) {
    return join(dir, `${base} [converted].${extension}`)
  }
  return candidate
}

export function withNumericSuffix(filePath: string, index: number): string {
  const dir = dirname(filePath)
  const extension = extname(filePath)
  const base = basename(filePath, extension)
  return join(dir, `${base} [${index}]${extension}`)
}
