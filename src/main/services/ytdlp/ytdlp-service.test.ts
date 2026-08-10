import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../utils/errors'
import type { ProcessManager, ProcessResult } from '../process/process-manager'
import { buildInspectArgs, createYtDlpService, parseInspectionOutput } from './ytdlp-service'

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
      '--no-call-home',
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
