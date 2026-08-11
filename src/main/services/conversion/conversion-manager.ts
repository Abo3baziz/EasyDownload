import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, join } from 'node:path'
import type { Conversion, ConversionStartOptions } from '../../../shared/types/conversion'
import { AppError, toAppError } from '../../utils/errors'
import type { FfmpegHandle, FfmpegService } from '../ffmpeg/ffmpeg-service'

export interface ConversionManager {
  start(options: ConversionStartOptions): Promise<Conversion>
  cancel(id: string): Promise<Conversion>
  list(): Conversion[]
  onUpdate(listener: (conversion: Conversion) => void): () => void
}

export interface ConversionManagerOptions {
  ffmpeg: FfmpegService
  statFile?: (path: string) => Promise<{ size: number } | undefined>
  now?: () => number
  generateId?: () => string
}

export function createConversionManager(options: ConversionManagerOptions): ConversionManager {
  const now = options.now ?? (() => Date.now())
  const generateId = options.generateId ?? (() => randomUUID())
  const conversions = new Map<string, Conversion>()
  const handles = new Map<string, FfmpegHandle>()
  const listeners = new Set<(conversion: Conversion) => void>()

  function emit(conversion: Conversion): void {
    for (const listener of listeners) {
      listener(conversion)
    }
  }

  function update(id: string, changes: Partial<Conversion>): Conversion {
    const conversion = conversions.get(id)
    if (!conversion) {
      throw new AppError('DownloadError', 'The conversion was not found.')
    }
    const updated: Conversion = { ...conversion, ...changes, updatedAt: now() }
    conversions.set(id, updated)
    emit(updated)
    return updated
  }

  function getOrThrow(id: string): Conversion {
    const conversion = conversions.get(id)
    if (!conversion) {
      throw new AppError('DownloadError', 'The conversion was not found.')
    }
    return conversion
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
              videoCodec: startOptions.videoCodec,
              audioCodec: startOptions.audioCodec
            },
            { onProgress: (progress) => update(conversion.id, { progress, status: 'running' }) }
          )
        : options.ffmpeg.extractAudio(
            {
              input,
              output: conversion.output,
              audioCodec: startOptions.audioCodec
            },
            { onProgress: (progress) => update(conversion.id, { progress, status: 'running' }) }
          )
    handles.set(conversion.id, handle)

    try {
      const result = await handle.result
      if (result.cancelled) {
        update(conversion.id, { status: 'cancelled' })
      } else {
        update(conversion.id, { status: 'completed', progress: { processedMs: 0 } })
      }
    } catch (err) {
      update(conversion.id, { status: 'failed', error: toAppError(err).toPayload() })
    } finally {
      handles.delete(conversion.id)
    }
  }

  return {
    async start(startOptions: ConversionStartOptions): Promise<Conversion> {
      if (options.statFile) {
        const info = await options.statFile(startOptions.input).catch(() => undefined)
        if (!info) {
          throw new AppError('FilesystemError', 'The source file does not exist.')
        }
      }
      const output = buildConversionOutputPath(startOptions.input, startOptions)
      const conversion: Conversion = {
        id: generateId(),
        type: startOptions.type,
        input: startOptions.input,
        output,
        status: 'running',
        progress: { processedMs: 0 },
        createdAt: now(),
        updatedAt: now()
      }
      conversions.set(conversion.id, conversion)
      emit(conversion)
      void run(conversion, startOptions.input, startOptions)
      return conversion
    },

    async cancel(id: string): Promise<Conversion> {
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

    list(): Conversion[] {
      return [...conversions.values()]
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
    case 'vp9':
      return 'webm'
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
