import { AppError } from '../../utils/errors'
import type { AudioCodec, VideoCodec } from '../../../shared/types/conversion'
import type { ProcessManager, ProcessResult } from '../process/process-manager'

export type FfmpegVideoCodec = VideoCodec
export type FfmpegAudioCodec = AudioCodec

export interface FfmpegConvertOptions {
  input: string
  output: string
  overwrite?: boolean
  videoCodec?: FfmpegVideoCodec
  audioCodec?: FfmpegAudioCodec
}

export interface FfmpegExtractAudioOptions {
  input: string
  output: string
  overwrite?: boolean
  audioCodec?: FfmpegAudioCodec
}

export interface FfmpegProgress {
  processedMs: number
}

export interface FfmpegResult {
  exitCode: number | null
  stdout: string
  stderr: string
  cancelled: boolean
}

export interface FfmpegHandle {
  result: Promise<FfmpegResult>
  cancel(): void
}

export interface FfmpegCallbacks {
  onProgress?: (progress: FfmpegProgress) => void
}

export interface FfmpegService {
  convert(options: FfmpegConvertOptions, callbacks?: FfmpegCallbacks): FfmpegHandle
  extractAudio(options: FfmpegExtractAudioOptions, callbacks?: FfmpegCallbacks): FfmpegHandle
}

export interface FfmpegServiceOptions {
  processes: ProcessManager
  ffmpegCommand?: string
}

const PROGRESS_ARGS = ['-progress', 'pipe:1', '-nostats'] as const

const OVERWRITE_ARG = ['-y'] as const

export const VIDEO_CODEC_ARGS: Record<FfmpegVideoCodec, readonly string[]> = {
  copy: ['-c:v', 'copy'],
  h264: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23'],
  hevc: ['-c:v', 'libx265', '-preset', 'fast', '-crf', '28']
}

export const AUDIO_CODEC_ARGS: Record<FfmpegAudioCodec, readonly string[]> = {
  copy: ['-c:a', 'copy'],
  mp3: ['-c:a', 'libmp3lame', '-q:a', '2'],
  aac: ['-c:a', 'aac', '-b:a', '192k'],
  opus: ['-c:a', 'libopus', '-b:a', '128k'],
  flac: ['-c:a', 'flac'],
  vorbis: ['-c:a', 'libvorbis', '-q:a', '5']
}

function overwriteArgs(overwrite: boolean | undefined): readonly string[] {
  return overwrite === false ? [] : OVERWRITE_ARG
}

export function buildConvertArgs(options: FfmpegConvertOptions): readonly string[] {
  return [
    ...overwriteArgs(options.overwrite),
    ...PROGRESS_ARGS,
    '-i',
    options.input,
    ...VIDEO_CODEC_ARGS[options.videoCodec ?? 'copy'],
    ...AUDIO_CODEC_ARGS[options.audioCodec ?? 'copy'],
    options.output
  ]
}

export function buildExtractAudioArgs(options: FfmpegExtractAudioOptions): readonly string[] {
  return [
    ...overwriteArgs(options.overwrite),
    ...PROGRESS_ARGS,
    '-i',
    options.input,
    '-vn',
    ...AUDIO_CODEC_ARGS[options.audioCodec ?? 'mp3'],
    options.output
  ]
}

export function parseFfmpegProgress(line: string): FfmpegProgress | undefined {
  const match = /^out_time_ms=(\d+)$/.exec(line.trim())
  if (!match) {
    return undefined
  }
  const processedMs = Math.round(Number(match[1]) / 1000)
  if (Number.isNaN(processedMs)) {
    return undefined
  }
  return { processedMs }
}

export function createFfmpegService(options: FfmpegServiceOptions): FfmpegService {
  const ffmpegCommand = options.ffmpegCommand ?? 'ffmpeg'

  function run(args: readonly string[], callbacks?: FfmpegCallbacks): FfmpegHandle {
    let cancelled = false
    const started = options.processes.startStreaming(ffmpegCommand, {
      args,
      onStdout: (line) => {
        const progress = parseFfmpegProgress(line)
        if (progress) {
          callbacks?.onProgress?.(progress)
        }
      }
    })

    const result = started.result
      .then((processResult): FfmpegResult => {
        if (processResult.exitCode !== 0 && !cancelled) {
          throw toFfmpegError(processResult)
        }
        return {
          exitCode: processResult.exitCode,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          cancelled
        }
      })
      .catch((err: unknown) => {
        if (err instanceof AppError) {
          throw err
        }
        const message = err instanceof Error ? err.message : String(err)
        if (/ENOENT/.test(message)) {
          throw new AppError('DependencyError', 'FFmpeg is not available.')
        }
        throw new AppError('ProcessError', `Failed to launch FFmpeg: ${message}`)
      })

    return {
      result,
      cancel: () => {
        cancelled = true
        started.kill()
      }
    }
  }

  return {
    convert: (convertOptions, callbacks) => run(buildConvertArgs(convertOptions), callbacks),
    extractAudio: (extractOptions, callbacks) =>
      run(buildExtractAudioArgs(extractOptions), callbacks)
  }
}

export function toFfmpegError(
  result: Pick<ProcessResult, 'exitCode' | 'stdout' | 'stderr'>
): AppError {
  const output = `${result.stdout}\n${result.stderr}`
  if (
    /no such file|unable to open|does not exist|is not a directory|permission denied/i.test(output)
  ) {
    return new AppError('FilesystemError', 'FFmpeg could not read or write the media file.')
  }
  if (
    /invalid data|malformed|decode|codec|encoder|unknown|conversion failed|format not found/i.test(
      output
    )
  ) {
    return new AppError('ProcessingError', 'FFmpeg could not process the media file.')
  }
  const detail = extractFfmpegErrorLine(result.stderr)
  return new AppError('ProcessingError', detail ?? `FFmpeg exited with code ${result.exitCode}.`)
}

function extractFfmpegErrorLine(stderr: string): string | undefined {
  const lines = stderr.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^(?:Error|Unable|Conversion failed)/i.test(trimmed)) {
      return trimmed.replace(/^(?:Error|Unable|Conversion failed):?\s*/i, '')
    }
  }
  return undefined
}
