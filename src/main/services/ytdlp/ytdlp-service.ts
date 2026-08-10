import { AppError } from '../../utils/errors'
import type { ProcessManager, ProcessResult } from '../process/process-manager'
import type { YtDlpMedia } from './types'

export interface YtDlpService {
  inspect(url: string): Promise<YtDlpMedia>
}

export interface YtDlpServiceOptions {
  processes: ProcessManager
  ytDlpCommand?: string
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 60_000

export function buildInspectArgs(url: string): readonly string[] {
  return ['--dump-json', '--no-playlist', '--skip-download', '--no-warnings', '--no-call-home', url]
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
