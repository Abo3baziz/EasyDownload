import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../utils/errors'
import type {
  ProcessManager,
  ProcessResult,
  StartStreamingOptions,
  StartedProcess
} from '../process/process-manager'
import {
  buildDownloadArgs,
  buildInspectArgs,
  createYtDlpService,
  parseEta,
  parseInspectionOutput,
  parseProgressLine,
  parseSize,
  toDownloadError
} from './ytdlp-service'

const SAMPLE_JSON = {
  id: 'abc123',
  title: 'Example Video',
  thumbnail: 'https://example.com/thumb.jpg',
  duration: 120,
  uploader: 'Example Channel',
  webpage_url_domain: 'www.youtube.com',
  formats: [
    {
      format_id: '137',
      ext: 'mp4',
      height: 1080,
      width: 1920,
      vcodec: 'avc1.640028',
      acodec: 'none',
      filesize_approx: 1048576,
      url: 'https://example.com/video.mp4'
    },
    {
      format_id: '18',
      ext: 'mp4',
      height: 360,
      vcodec: 'avc1.42001E',
      acodec: 'mp4a.40.2',
      url: 'https://example.com/small.mp4'
    }
  ]
}

function createMockProcesses(result?: ProcessResult, error?: Error): ProcessManager {
  const runToCompletion = vi.fn()
  if (error) {
    runToCompletion.mockRejectedValue(error)
  } else {
    runToCompletion.mockResolvedValue(result)
  }
  return { runToCompletion } as unknown as ProcessManager
}

function successResult(stdout: string): ProcessResult {
  return { stdout, stderr: '', exitCode: 0, timedOut: false }
}

describe('buildInspectArgs', () => {
  it('builds safe inspection arguments with the URL as a single argument', () => {
    const url = 'https://example.com/watch?v=123'
    expect(buildInspectArgs(url)).toEqual([
      '--dump-json',
      '--no-playlist',
      '--skip-download',
      '--no-warnings',
      '--encoding',
      'utf-8',
      url
    ])
  })
})

describe('createYtDlpService.inspect', () => {
  it('parses the first JSON line of a successful inspection', async () => {
    const processes = createMockProcesses(successResult(JSON.stringify(SAMPLE_JSON)))
    const service = createYtDlpService({ processes })

    await expect(service.inspect('https://example.com/watch?v=abc123')).resolves.toEqual(SAMPLE_JSON)
    expect(processes.runToCompletion).toHaveBeenCalledWith('yt-dlp', {
      args: buildInspectArgs('https://example.com/watch?v=abc123'),
      timeoutMs: 60_000
    })
  })

  it('maps an unsupported URL message to UnsupportedMediaError', async () => {
    const processes = createMockProcesses({
      stdout: '',
      stderr: 'ERROR: Unsupported URL: https://example.com/bad',
      exitCode: 1,
      timedOut: false
    })
    const service = createYtDlpService({ processes })

    await expect(service.inspect('https://example.com/bad')).rejects.toMatchObject({
      code: 'UnsupportedMediaError'
    })
  })

  it('maps network failure output to NetworkError', async () => {
    const processes = createMockProcesses({
      stdout: '',
      stderr: 'ERROR: Unable to download webpage: HTTP Error 403: Forbidden',
      exitCode: 1,
      timedOut: false
    })
    const service = createYtDlpService({ processes })

    await expect(service.inspect('https://example.com/private')).rejects.toMatchObject({
      code: 'NetworkError'
    })
  })

  it('maps a timed-out process to ProcessError', async () => {
    const processes = createMockProcesses({
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: true
    })
    const service = createYtDlpService({ processes })

    await expect(service.inspect('https://example.com/slow')).rejects.toMatchObject({
      code: 'ProcessError'
    })
  })

  it('maps a generic failure to ProcessError with the yt-dlp error line', async () => {
    const processes = createMockProcesses({
      stdout: '',
      stderr: 'ERROR: [foo] 123: Something went wrong',
      exitCode: 1,
      timedOut: false
    })
    const service = createYtDlpService({ processes })

    await expect(service.inspect('https://example.com/fail')).rejects.toMatchObject({
      code: 'ProcessError',
      message: '[foo] 123: Something went wrong'
    })
  })

  it('maps a missing executable to DependencyError', async () => {
    const processes = createMockProcesses(undefined, Object.assign(new Error('spawn yt-dlp ENOENT'), { code: 'ENOENT' }))
    const service = createYtDlpService({ processes })

    await expect(service.inspect('https://example.com/v')).rejects.toMatchObject({
      code: 'DependencyError'
    })
  })

  it('respects a custom command and timeout', async () => {
    const processes = createMockProcesses(successResult(JSON.stringify(SAMPLE_JSON)))
    const service = createYtDlpService({ processes, ytDlpCommand: '/opt/bin/yt-dlp', timeoutMs: 10_000 })

    await service.inspect('https://example.com/watch?v=abc123')
    expect(processes.runToCompletion).toHaveBeenCalledWith('/opt/bin/yt-dlp', {
      args: expect.any(Array),
      timeoutMs: 10_000
    })
  })
})

describe('parseInspectionOutput', () => {
  it('parses a single JSON object from stdout', () => {
    expect(parseInspectionOutput(JSON.stringify(SAMPLE_JSON))).toEqual(SAMPLE_JSON)
  })

  it('throws a ProcessError for empty stdout', () => {
    expect(() => parseInspectionOutput('')).toThrow(AppError)
  })

  it('throws a ProcessError for malformed JSON', () => {
    expect(() => parseInspectionOutput('{invalid')).toThrow(AppError)
  })
})

describe('buildDownloadArgs', () => {
  it('builds download arguments with the format id, output template, and URL', () => {
    const args = buildDownloadArgs('https://example.com/watch?v=1', '137', 'D:\\Downloads')
    expect(args).toEqual([
      '--newline',
      '--no-playlist',
      '--encoding',
      'utf-8',
      '-f',
      '137',
      '-o',
      'D:\\Downloads\\%(title)s [%(id)s] [137].%(ext)s',
      '--print',
      'after_move:filepath',
      'https://example.com/watch?v=1'
    ])
  })

  it('requests best audio and a merge container when merging is enabled', () => {
    const args = buildDownloadArgs('https://example.com/watch?v=1', '137', 'D:\\Downloads', {
      merge: { outputFormat: 'mp4' }
    })
    expect(args).toEqual([
      '--newline',
      '--no-playlist',
      '--encoding',
      'utf-8',
      '-f',
      '137+bestaudio',
      '-o',
      'D:\\Downloads\\%(title)s [%(id)s] [137].%(ext)s',
      '--print',
      'after_move:filepath',
      '--merge-output-format',
      'mp4',
      'https://example.com/watch?v=1'
    ])
  })

  it('selects best audio without forcing a container when merging has no output format', () => {
    const args = buildDownloadArgs('https://example.com/watch?v=1', '248', 'D:\\Downloads', {
      merge: {}
    })
    expect(args).toEqual([
      '--newline',
      '--no-playlist',
      '--encoding',
      'utf-8',
      '-f',
      '248+bestaudio',
      '-o',
      'D:\\Downloads\\%(title)s [%(id)s] [248].%(ext)s',
      '--print',
      'after_move:filepath',
      'https://example.com/watch?v=1'
    ])
  })

  it('points yt-dlp at the bundled ffmpeg location when provided', () => {
    const args = buildDownloadArgs('https://example.com/watch?v=1', '137', 'D:\\Downloads', {
      merge: { outputFormat: 'mp4' },
      ffmpegLocation: 'D:\\app\\resources\\bin'
    })
    expect(args).toEqual([
      '--newline',
      '--no-playlist',
      '--encoding',
      'utf-8',
      '-f',
      '137+bestaudio',
      '-o',
      'D:\\Downloads\\%(title)s [%(id)s] [137].%(ext)s',
      '--print',
      'after_move:filepath',
      '--merge-output-format',
      'mp4',
      '--ffmpeg-location',
      'D:\\app\\resources\\bin',
      'https://example.com/watch?v=1'
    ])
  })

  it('omits the ffmpeg location when none is provided', () => {
    const args = buildDownloadArgs('https://example.com/watch?v=1', '137', 'D:\\Downloads')
    expect(args).not.toContain('--ffmpeg-location')
  })

  it('produces distinct output templates for different formats of the same video', () => {
    const outputOf = (args: readonly string[]): string => {
      const index = args.indexOf('-o')
      return args[index + 1]!
    }
    const args1080 = buildDownloadArgs('https://example.com/watch?v=1', '137', 'D:\\Downloads')
    const args720 = buildDownloadArgs('https://example.com/watch?v=1', '18', 'D:\\Downloads')

    expect(outputOf(args1080)).not.toBe(outputOf(args720))
    expect(outputOf(args1080)).toContain('[137]')
    expect(outputOf(args720)).toContain('[18]')
  })
})

describe('parseSize', () => {
  it('parses binary units', () => {
    expect(parseSize('1.17GiB')).toBe(1.17 * 1024 ** 3)
    expect(parseSize('288.32MiB')).toBe(288.32 * 1024 ** 2)
    expect(parseSize('512KiB')).toBe(512 * 1024)
  })

  it('parses decimal units', () => {
    expect(parseSize('1.5MB')).toBe(1_500_000)
  })

  it('returns undefined for unknown units', () => {
    expect(parseSize('1.5XB')).toBeUndefined()
  })
})

describe('parseEta', () => {
  it('parses MM:SS and HH:MM:SS', () => {
    expect(parseEta('01:32')).toBe(92)
    expect(parseEta('01:01:32')).toBe(3692)
  })

  it('returns undefined for invalid values', () => {
    expect(parseEta('abc')).toBeUndefined()
  })
})

describe('parseProgressLine', () => {
  it('parses percent, size, speed, and ETA from a yt-dlp progress line', () => {
    expect(parseProgressLine('[download]  72.1% of 1.17GiB at 4.8MiB/s ETA 01:32')).toEqual({
      percent: 72.1,
      downloadedBytes: Math.round(0.721 * 1.17 * 1024 ** 3),
      totalBytes: 1.17 * 1024 ** 3,
      speedBytesPerSecond: 4.8 * 1024 ** 2,
      etaSeconds: 92
    })
  })

  it('parses a completion line without speed or ETA', () => {
    expect(parseProgressLine('[download] 100% of 1.17GiB')).toEqual({
      percent: 100,
      downloadedBytes: Math.round(1.17 * 1024 ** 3),
      totalBytes: 1.17 * 1024 ** 3
    })
  })

  it('returns undefined for non-progress lines', () => {
    expect(parseProgressLine('[download] Destination: /tmp/video.mp4')).toBeUndefined()
    expect(parseProgressLine('[Merger] Merging formats into "video.mp4"')).toBeUndefined()
  })
})

describe('toDownloadError', () => {
  function result(stderr: string): ProcessResult {
    return { stdout: '', stderr, exitCode: 1, timedOut: false }
  }

  it('maps network failures to NetworkError', () => {
    expect(toDownloadError(result('ERROR: Unable to download webpage: HTTP Error 404')).code).toBe(
      'NetworkError'
    )
  })

  it('attaches the yt-dlp error line as details for network failures', () => {
    expect(
      toDownloadError(result('ERROR: unable to download video data: HTTP Error 403: Forbidden'))
    ).toMatchObject({
      code: 'NetworkError',
      details: 'unable to download video data: HTTP Error 403: Forbidden'
    })
  })

  it('maps a missing format to DownloadError with recovery guidance', () => {
    expect(
      toDownloadError(result('ERROR: [youtube] abc: Requested format is not available'))
    ).toMatchObject({
      code: 'DownloadError',
      message: expect.stringContaining('no longer available')
    })
  })

  it('maps filesystem failures to FilesystemError', () => {
    expect(toDownloadError(result('ERROR: unable to write to file: No space left on device')).code).toBe(
      'FilesystemError'
    )
  })

  it('maps processing failures to ProcessingError', () => {
    expect(
      toDownloadError(result('ERROR: [Merger] ffmpeg exited with code 1')).code
    ).toBe('ProcessingError')
  })

  it('falls back to ProcessError with the yt-dlp error line', () => {
    expect(toDownloadError(result('ERROR: [foo] 123: Unexpected failure'))).toMatchObject({
      code: 'ProcessError',
      message: '[foo] 123: Unexpected failure'
    })
  })
})

describe('createYtDlpService.startDownload', () => {
  function createStreamingProcesses(overrides: {
    exitCode?: number | null
    stdout?: string
    stderr?: string
    rejectWith?: Error
  } = {}) {
    const kill = vi.fn()
    const result = overrides.rejectWith
      ? Promise.reject(overrides.rejectWith)
      : Promise.resolve({
          stdout: overrides.stdout ?? '',
          stderr: overrides.stderr ?? '',
          exitCode: overrides.exitCode ?? 0,
          timedOut: false
        } satisfies ProcessResult)
    const startStreaming = vi.fn().mockImplementation(
      (_command: string, options?: StartStreamingOptions): StartedProcess => {
        for (const line of (overrides.stdout ?? '').split(/\r?\n/)) {
          if (line !== '') options?.onStdout?.(line)
        }
        for (const line of (overrides.stderr ?? '').split(/\r?\n/)) {
          if (line !== '') options?.onStderr?.(line)
        }
        return { result, kill }
      }
    )
    return {
      processes: { startStreaming } as unknown as ProcessManager,
      startStreaming,
      kill
    }
  }

  it('runs yt-dlp with the download arguments and resolves the process result', async () => {
    const { processes, startStreaming } = createStreamingProcesses({
      exitCode: 0,
      stderr: '[download] 100% of 10.00MiB\n'
    })
    const service = createYtDlpService({ processes })

    const handle = service.startDownload({
      url: 'https://example.com/watch?v=1',
      formatId: '137',
      directory: 'D:\\Downloads'
    })

    expect(startStreaming).toHaveBeenCalledWith('yt-dlp', {
      args: buildDownloadArgs('https://example.com/watch?v=1', '137', 'D:\\Downloads'),
      onStdout: expect.any(Function),
      onStderr: expect.any(Function)
    })

    const result = await handle.result
    expect(result.exitCode).toBe(0)
    expect(result.cancelled).toBe(false)
  })

  it('merges best audio into a video-only format when requested', async () => {
    const { processes, startStreaming } = createStreamingProcesses({ exitCode: 0 })
    const service = createYtDlpService({ processes })

    service.startDownload({
      url: 'https://example.com/watch?v=1',
      formatId: '137',
      directory: 'D:\\Downloads',
      mergeAudio: true,
      mergeOutputFormat: 'mp4'
    })

    expect(startStreaming).toHaveBeenCalledWith(
      'yt-dlp',
      expect.objectContaining({
        args: expect.arrayContaining(['-f', '137+bestaudio', '--merge-output-format', 'mp4'])
      })
    )
  })

  it('passes the bundled ffmpeg location to yt-dlp', async () => {
    const { processes, startStreaming } = createStreamingProcesses({ exitCode: 0 })
    const service = createYtDlpService({ processes, ffmpegLocation: 'D:\\app\\resources\\bin' })

    service.startDownload({
      url: 'https://example.com/watch?v=1',
      formatId: '137',
      directory: 'D:\\Downloads',
      mergeAudio: true
    })

    expect(startStreaming).toHaveBeenCalledWith(
      'yt-dlp',
      expect.objectContaining({
        args: expect.arrayContaining(['--ffmpeg-location', 'D:\\app\\resources\\bin'])
      })
    )
  })

  it('reports progress and the destination via callbacks', async () => {
    const { processes } = createStreamingProcesses({
      exitCode: 0,
      stderr: '[download] Destination: D:\\Downloads\\Example.mp4\n[download]  50% of 10.00MiB\n'
    })
    const service = createYtDlpService({ processes })
    const onProgress = vi.fn()
    const onPhase = vi.fn()

    const handle = service.startDownload(
      { url: 'https://example.com/watch?v=1', formatId: '18', directory: 'D:\\Downloads' },
      { onProgress, onPhase }
    )

    const result = await handle.result
    expect(result.destination).toBe('D:\\Downloads\\Example.mp4')
    expect(onProgress).toHaveBeenCalledWith({
      percent: 50,
      downloadedBytes: Math.round(0.5 * 10 * 1024 ** 2),
      totalBytes: 10 * 1024 ** 2
    })
    expect(onPhase).toHaveBeenCalledWith('downloading')
  })

  it('reports the final merged file as the destination for merged downloads', async () => {
    const { processes } = createStreamingProcesses({
      exitCode: 0,
      stderr:
        '[download] Destination: D:\\Downloads\\Example.f137.mp4\n' +
        '[download] Destination: D:\\Downloads\\Example.f251.webm\n' +
        '[Merger] Merging formats into "D:\\Downloads\\Example.mp4"\n'
    })
    const service = createYtDlpService({ processes })

    const result = await service
      .startDownload({
        url: 'https://example.com/watch?v=1',
        formatId: '137',
        directory: 'D:\\Downloads',
        mergeAudio: true
      })
      .result

    expect(result.destination).toBe('D:\\Downloads\\Example.mp4')
  })

  it('reports the processing phase when post-processing lines appear', async () => {
    const { processes } = createStreamingProcesses({
      exitCode: 0,
      stderr: '[Merger] Merging formats into "video.mp4"\n'
    })
    const service = createYtDlpService({ processes })
    const onPhase = vi.fn()

    await service
      .startDownload(
        { url: 'https://example.com/watch?v=1', formatId: '137', directory: 'D:\\Downloads' },
        { onPhase }
      )
      .result

    expect(onPhase).toHaveBeenCalledWith('processing')
  })

  it('captures the final path printed on stdout and prefers it over parsed lines', async () => {
    const kill = vi.fn()
    const startStreaming = vi.fn().mockImplementation(
      (_command: string, options?: StartStreamingOptions): StartedProcess => {
        for (const line of ['[download] Destination: D:\\Downloads\\Stale.mp4']) {
          options?.onStderr?.(line)
        }
        for (const line of [
          'D:\\Downloads\\Example.f137.mp4',
          'D:\\Downloads\\Example.f251.webm',
          'D:\\Downloads\\Example.mp4'
        ]) {
          options?.onStdout?.(line)
        }
        return {
          result: Promise.resolve({
            stdout: '',
            stderr: '',
            exitCode: 0,
            timedOut: false
          } satisfies ProcessResult),
          kill
        }
      }
    )
    const processes = { startStreaming } as unknown as ProcessManager
    const service = createYtDlpService({ processes })

    const result = await service
      .startDownload({
        url: 'https://example.com/watch?v=1',
        formatId: '137',
        directory: 'D:\\Downloads',
        mergeAudio: true
      })
      .result

    expect(result.destination).toBe('D:\\Downloads\\Example.mp4')
  })

  it('ignores path-like lines on stderr', async () => {
    const { processes } = createStreamingProcesses({
      exitCode: 0,
      stderr: 'D:\\Downloads\\Example.mp4\n'
    })
    const service = createYtDlpService({ processes })

    const result = await service
      .startDownload({
        url: 'https://example.com/watch?v=1',
        formatId: '18',
        directory: 'D:\\Downloads'
      })
      .result

    expect(result.destination).toBeUndefined()
  })

  it('keeps the parsed destination when the print line never appears', async () => {
    const { processes } = createStreamingProcesses({
      exitCode: 0,
      stderr: '[download] Destination: D:\\Downloads\\Example.mp4\n'
    })
    const service = createYtDlpService({ processes })

    const result = await service
      .startDownload({
        url: 'https://example.com/watch?v=1',
        formatId: '18',
        directory: 'D:\\Downloads'
      })
      .result

    expect(result.destination).toBe('D:\\Downloads\\Example.mp4')
  })

  it('kills the process and reports cancellation when cancel is called', async () => {
    const { processes, kill } = createStreamingProcesses({
      exitCode: null,
      stderr: '[download]  10% of 10.00MiB\n'
    })
    const service = createYtDlpService({ processes })

    const handle = service.startDownload({
      url: 'https://example.com/watch?v=1',
      formatId: '18',
      directory: 'D:\\Downloads'
    })

    handle.cancel()

    const result = await handle.result
    expect(kill).toHaveBeenCalled()
    expect(result.cancelled).toBe(true)
  })

  it('kills the process and reports pause without cancellation', async () => {
    const { processes, kill } = createStreamingProcesses({ exitCode: null })
    const service = createYtDlpService({ processes })
    const handle = service.startDownload({
      url: 'https://example.com/watch?v=1',
      formatId: '18',
      directory: 'D:\\Downloads'
    })

    handle.pause?.()

    const result = await handle.result
    expect(kill).toHaveBeenCalled()
    expect(result.paused).toBe(true)
    expect(result.cancelled).toBe(false)
  })

  it('maps a missing executable to DependencyError', async () => {
    const { processes } = createStreamingProcesses({
      rejectWith: Object.assign(new Error('spawn yt-dlp ENOENT'), { code: 'ENOENT' })
    })
    const service = createYtDlpService({ processes })

    const handle = service.startDownload({
      url: 'https://example.com/watch?v=1',
      formatId: '18',
      directory: 'D:\\Downloads'
    })

    await expect(handle.result).rejects.toMatchObject({ code: 'DependencyError' })
  })
})
