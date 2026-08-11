import { join } from 'node:path'
import type { DownloadProgress } from '../../../shared/types/download'
import { AppError } from '../../utils/errors'
import type { ProcessManager, ProcessResult } from '../process/process-manager'
import type { YtDlpMedia } from './types'

export interface YtDlpService {
  inspect(url: string): Promise<YtDlpMedia>
  startDownload(
    options: DownloadMediaOptions,
    callbacks?: YtDlpDownloadCallbacks
  ): DownloadMediaHandle
}

export interface YtDlpServiceOptions {
  processes: ProcessManager
  ytDlpCommand?: string
  timeoutMs?: number
}

export interface DownloadMediaOptions {
  url: string
  formatId: string
  directory: string
}

export type DownloadPhase = 'downloading' | 'processing'

export interface YtDlpDownloadCallbacks {
  onProgress?: (progress: DownloadProgress) => void
  onPhase?: (phase: DownloadPhase) => void
}

export interface DownloadMediaResult {
  exitCode: number | null
  stdout: string
  stderr: string
  cancelled: boolean
  destination?: string
}

export interface DownloadMediaHandle {
  result: Promise<DownloadMediaResult>
  cancel(): void
}

const DEFAULT_TIMEOUT_MS = 60_000

export function buildInspectArgs(url: string): readonly string[] {
  return ['--dump-json', '--no-playlist', '--skip-download', '--no-warnings', '--no-call-home', url]
}

export function buildDownloadArgs(
  url: string,
  formatId: string,
  directory: string
): readonly string[] {
  return [
    '--newline',
    '--no-playlist',
    '--no-call-home',
    '-f',
    formatId,
    '-o',
    join(directory, '%(title)s [%(id)s].%(ext)s'),
    url
  ]
}

export function createYtDlpService(options: YtDlpServiceOptions): YtDlpService {
  const ytDlpCommand = options.ytDlpCommand ?? 'yt-dlp'
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async inspect(url: string): Promise<YtDlpMedia> {
      let result: ProcessResult
      try {
        result = await options.processes.runToCompletion(ytDlpCommand, {
          args: buildInspectArgs(url),
          timeoutMs
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (/ENOENT/.test(message)) {
          throw new AppError('DependencyError', 'yt-dlp is not available.')
        }
        throw new AppError('ProcessError', `Failed to launch yt-dlp: ${message}`)
      }

      if (result.timedOut) {
        throw new AppError('ProcessError', 'yt-dlp inspection timed out.')
      }
      if (result.exitCode !== 0) {
        throw toInspectionError(result)
      }

      return parseInspectionOutput(result.stdout)
    },

    startDownload(
      downloadOptions: DownloadMediaOptions,
      callbacks?: YtDlpDownloadCallbacks
    ): DownloadMediaHandle {
      let cancelled = false
      let destination: string | undefined

      const started = options.processes.startStreaming(ytDlpCommand, {
        args: buildDownloadArgs(
          downloadOptions.url,
          downloadOptions.formatId,
          downloadOptions.directory
        ),
        onStdout: (line) => handleLine(line),
        onStderr: (line) => handleLine(line)
      })

      function handleLine(line: string): void {
        const destinationMatch = /^\[download\] Destination: (.+)$/i.exec(line.trim())
        if (destinationMatch) {
          destination = destinationMatch[1].trim()
        }
        const progress = parseProgressLine(line)
        if (progress) {
          callbacks?.onPhase?.('downloading')
          callbacks?.onProgress?.(progress)
          return
        }
        if (isProcessingLine(line)) {
          callbacks?.onPhase?.('processing')
        }
      }

      const result = started.result
        .then((processResult): DownloadMediaResult => {
          return {
            exitCode: processResult.exitCode,
            stdout: processResult.stdout,
            stderr: processResult.stderr,
            cancelled,
            destination
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          if (/ENOENT/.test(message)) {
            throw new AppError('DependencyError', 'yt-dlp is not available.')
          }
          throw new AppError('ProcessError', `Failed to launch yt-dlp: ${message}`)
        })

      return {
        result,
        cancel: () => {
          cancelled = true
          started.kill()
        }
      }
    }
  }
}

export function toInspectionError(result: ProcessResult): AppError {
  const output = `${result.stdout}\n${result.stderr}`
  if (/unsupported url/i.test(output)) {
    return new AppError('UnsupportedMediaError', 'The provided URL is not supported by yt-dlp.')
  }
  if (
    /unable to (download|fetch|extract)|network|connection|timed out|http error|\b403\b|\b404\b|geo[- ]?restricted|video (is )?unavailable/i.test(
      output
    )
  ) {
    return new AppError(
      'NetworkError',
      'yt-dlp could not fetch media information. The video may be unavailable or the network request failed.'
    )
  }
  const detail = extractErrorLine(result.stderr)
  return new AppError('ProcessError', detail ?? `yt-dlp exited with code ${result.exitCode}.`)
}

export function toDownloadError(
  result: Pick<ProcessResult, 'exitCode' | 'stdout' | 'stderr'>
): AppError {
  const output = `${result.stdout}\n${result.stderr}`
  if (/unsupported url/i.test(output)) {
    return new AppError('UnsupportedMediaError', 'The provided URL is not supported by yt-dlp.')
  }
  if (
    /unable to (download|fetch|extract)|network|connection|timed out|http error|\b403\b|\b404\b|geo[- ]?restricted|video (is )?unavailable/i.test(
      output
    )
  ) {
    return new AppError(
      'NetworkError',
      'yt-dlp could not complete the download. The video may be unavailable or the network request failed.'
    )
  }
  if (/no space|disk|permission|access denied|destination|unable to write/i.test(output)) {
    return new AppError('FilesystemError', 'yt-dlp could not write the downloaded file.')
  }
  if (/ffmpeg|postprocess|merger|video conver|extract audio|unable to fix/i.test(output)) {
    return new AppError(
      'ProcessingError',
      'yt-dlp could not process the downloaded media after downloading.'
    )
  }
  const detail = extractErrorLine(result.stderr)
  return new AppError('ProcessError', detail ?? `yt-dlp exited with code ${result.exitCode}.`)
}

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
  kb: 1_000,
  mb: 1_000_000,
  gb: 1_000_000_000,
  tb: 1_000_000_000_000
}

export function parseSize(value: string): number | undefined {
  const match = /^([\d.]+)\s*(b|kib|mib|gib|tib|kb|mb|gb|tb)$/i.exec(value.trim())
  if (!match) {
    return undefined
  }
  const unit = SIZE_UNITS[match[2].toLowerCase()]
  return unit !== undefined ? Number(match[1]) * unit : undefined
}

export function parseEta(value: string): number | undefined {
  const parts = value.split(':').map((part) => Number(part))
  if (parts.length === 0 || parts.some(Number.isNaN)) {
    return undefined
  }
  let seconds = 0
  for (const part of parts) {
    seconds = seconds * 60 + part
  }
  return seconds
}

export function parseProgressLine(line: string): DownloadProgress | undefined {
  const trimmed = line.trim()
  if (!/^\[download\]/.test(trimmed)) {
    return undefined
  }
  const percentMatch = /([\d.]+)%/.exec(trimmed)
  if (!percentMatch) {
    return undefined
  }
  const percent = Number(percentMatch[1])
  if (Number.isNaN(percent)) {
    return undefined
  }

  const progress: DownloadProgress = { percent }

  const totalMatch = /of\s+~?([\d.]+\s*(?:b|kib|mib|gib|tib|kb|mb|gb|tb))/i.exec(trimmed)
  if (totalMatch) {
    const totalBytes = parseSize(totalMatch[1])
    if (totalBytes !== undefined) {
      progress.totalBytes = totalBytes
      progress.downloadedBytes = Math.round((percent / 100) * totalBytes)
    }
  }

  const speedMatch = /at\s+([\d.]+\s*(?:b|kib|mib|gib|tib|kb|mb|gb|tb))\/s/i.exec(trimmed)
  if (speedMatch) {
    const speedBytes = parseSize(speedMatch[1])
    if (speedBytes !== undefined) {
      progress.speedBytesPerSecond = speedBytes
    }
  }

  const etaMatch = /ETA\s+(\d{1,3}(?::\d{2}){1,2})/.exec(trimmed)
  if (etaMatch) {
    const etaSeconds = parseEta(etaMatch[1])
    if (etaSeconds !== undefined) {
      progress.etaSeconds = etaSeconds
    }
  }

  return progress
}

function isProcessingLine(line: string): boolean {
  return /^\[(merger|videoconvertor|extractaudio|embedthumbnail|fixup|metadata|sponsorblock)\]/i.test(
    line.trim()
  )
}

export function parseInspectionOutput(stdout: string): YtDlpMedia {
  const firstLine = stdout.split(/\r?\n/).find((line) => line.trim() !== '')
  if (!firstLine) {
    throw new AppError('ProcessError', 'yt-dlp returned no metadata.')
  }
  try {
    const parsed = JSON.parse(firstLine) as YtDlpMedia
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('missing required fields')
    }
    return parsed
  } catch {
    throw new AppError('ProcessError', 'yt-dlp returned malformed metadata.')
  }
}

function extractErrorLine(stderr: string): string | undefined {
  const lines = stderr.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^ERROR:/i.test(trimmed)) {
      return trimmed.replace(/^ERROR:\s*/i, '')
    }
  }
  return undefined
}
