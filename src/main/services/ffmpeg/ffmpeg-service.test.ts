import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type {
  FfmpegProgress,
  FfmpegResult
} from './ffmpeg-service'
import type { ProcessManager, ProcessResult, StartedProcess } from '../process/process-manager'
import {
  buildConvertArgs,
  buildExtractAudioArgs,
  buildMergeArgs,
  createFfmpegService,
  parseFfmpegProgress,
  toFfmpegError
} from './ffmpeg-service'

function successResult(): ProcessResult {
  return { stdout: '', stderr: '', exitCode: 0, timedOut: false }
}

function startedProcess(result?: ProcessResult, error?: Error): StartedProcess {
  return {
    result: error ? Promise.reject(error) : Promise.resolve(result ?? successResult()),
    kill: vi.fn()
  }
}

function createMockProcesses(): ProcessManager & { startStreaming: Mock } {
  const startStreaming = vi.fn()
  return { startStreaming } as unknown as ProcessManager & { startStreaming: Mock }
}

describe('buildMergeArgs', () => {
  it('builds safe merge arguments from input paths', () => {
    expect(
      buildMergeArgs({ videoInput: 'video.mp4', audioInput: 'audio.m4a', output: 'out.mp4' })
    ).toEqual([
      '-y',
      '-progress',
      'pipe:1',
      '-nostats',
      '-i',
      'video.mp4',
      '-i',
      'audio.m4a',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c',
      'copy',
      'out.mp4'
    ])
  })

  it('omits the overwrite flag when overwrite is false', () => {
    expect(
      buildMergeArgs({ videoInput: 'v.mp4', audioInput: 'a.m4a', output: 'o.mp4', overwrite: false })
    ).not.toContain('-y')
  })
})

describe('buildConvertArgs', () => {
  it('defaults to stream copying for both tracks', () => {
    expect(buildConvertArgs({ input: 'in.mkv', output: 'out.mp4' })).toEqual([
      '-y',
      '-progress',
      'pipe:1',
      '-nostats',
      '-i',
      'in.mkv',
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      'out.mp4'
    ])
  })

  it('applies the requested video and audio codecs', () => {
    expect(
      buildConvertArgs({ input: 'in.mkv', output: 'out.mp4', videoCodec: 'h264', audioCodec: 'aac' })
    ).toEqual([
      '-y',
      '-progress',
      'pipe:1',
      '-nostats',
      '-i',
      'in.mkv',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      'out.mp4'
    ])
  })
})

describe('buildExtractAudioArgs', () => {
  it('defaults to MP3 extraction and strips video', () => {
    expect(buildExtractAudioArgs({ input: 'video.mp4', output: 'audio.mp3' })).toEqual([
      '-y',
      '-progress',
      'pipe:1',
      '-nostats',
      '-i',
      'video.mp4',
      '-vn',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '2',
      'audio.mp3'
    ])
  })

  it('applies the requested audio codec', () => {
    expect(
      buildExtractAudioArgs({ input: 'video.mp4', output: 'audio.opus', audioCodec: 'opus' })
    ).toEqual(
      expect.arrayContaining(['-vn', '-c:a', 'libopus', '-b:a', '128k', 'audio.opus'])
    )
  })
})

describe('parseFfmpegProgress', () => {
  it('parses the processed milliseconds from out_time_ms', () => {
    expect(parseFfmpegProgress('out_time_ms=1234000')).toEqual({ processedMs: 1234 })
  })

  it('ignores non-progress lines', () => {
    expect(parseFfmpegProgress('frame=123')).toBeUndefined()
    expect(parseFfmpegProgress('')).toBeUndefined()
  })
})

describe('createFfmpegService', () => {
  it('runs a merge operation to completion', async () => {
    const processes = createMockProcesses()
    processes.startStreaming.mockReturnValue(startedProcess())
    const service = createFfmpegService({ processes })
    const options = { videoInput: 'v.mp4', audioInput: 'a.m4a', output: 'o.mp4' }

    const handle = service.merge(options)

    await expect(handle.result).resolves.toMatchObject({ exitCode: 0, cancelled: false })
    expect(processes.startStreaming).toHaveBeenCalledWith('ffmpeg', {
      args: buildMergeArgs(options),
      onStdout: expect.any(Function)
    })
  })

  it('reports progress parsed from ffmpeg output', async () => {
    const processes = createMockProcesses()
    processes.startStreaming.mockImplementation(
      (command: string, options: { onStdout?: (line: string) => void }) => {
        options.onStdout?.('out_time_ms=500000')
        options.onStdout?.('out_time_ms=1000000')
        return startedProcess()
      }
    )
    const service = createFfmpegService({ processes })
    const progress: FfmpegProgress[] = []

    const handle = service.convert({ input: 'in.mkv', output: 'out.mp4' }, { onProgress: (p) => progress.push(p) })
    await handle.result

    expect(progress).toEqual([{ processedMs: 500 }, { processedMs: 1000 }])
  })

  it('maps a non-zero exit code to a ProcessingError', async () => {
    const processes = createMockProcesses()
    processes.startStreaming.mockReturnValue(
      startedProcess({
        stdout: '',
        stderr: 'Error while decoding stream #0:0: Invalid data',
        exitCode: 1,
        timedOut: false
      })
    )
    const service = createFfmpegService({ processes })

    const handle = service.extractAudio({ input: 'broken.mp4', output: 'out.mp3' })

    await expect(handle.result).rejects.toMatchObject({ code: 'ProcessingError' })
  })

  it('maps missing files to a FilesystemError', async () => {
    const processes = createMockProcesses()
    processes.startStreaming.mockReturnValue(
      startedProcess({
        stdout: '',
        stderr: 'in.mp4: No such file or directory',
        exitCode: 1,
        timedOut: false
      })
    )
    const service = createFfmpegService({ processes })

    const handle = service.convert({ input: 'in.mp4', output: 'out.mkv' })

    await expect(handle.result).rejects.toMatchObject({ code: 'FilesystemError' })
  })

  it('maps an unlaunchable FFmpeg to a DependencyError', async () => {
    const processes = createMockProcesses()
    processes.startStreaming.mockReturnValue(
      startedProcess(undefined, Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }))
    )
    const service = createFfmpegService({ processes })

    const handle = service.convert({ input: 'in.mkv', output: 'out.mp4' })

    await expect(handle.result).rejects.toMatchObject({ code: 'DependencyError' })
  })

  it('resolves a cancelled operation without a mapped error', async () => {
    const processes = createMockProcesses()
    const kill = vi.fn()
    const result = Promise.resolve({
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false
    } satisfies ProcessResult)
    processes.startStreaming.mockReturnValue({ result, kill })
    const service = createFfmpegService({ processes })

    const handle = service.merge({
      videoInput: 'v.mp4',
      audioInput: 'a.m4a',
      output: 'o.mp4'
    })
    handle.cancel()

    await expect(handle.result).resolves.toMatchObject({ exitCode: null, cancelled: true })
    expect(kill).toHaveBeenCalled()
  })
})

describe('toFfmpegError', () => {
  it('maps missing-file output to a FilesystemError', () => {
    const error = toFfmpegError({
      stdout: '',
      stderr: 'video.mp4: No such file or directory',
      exitCode: 1
    })
    expect(error.code).toBe('FilesystemError')
  })

  it('maps codec and conversion output to a ProcessingError', () => {
    const error = toFfmpegError({
      stdout: '',
      stderr: 'Unknown encoder libfoo. Conversion failed!',
      exitCode: 1
    })
    expect(error.code).toBe('ProcessingError')
  })

  it('falls back to a ProcessingError with a stderr detail', () => {
    const error = toFfmpegError({
      stdout: '',
      stderr: 'Error: something unexpected happened',
      exitCode: 1
    })
    expect(error).toMatchObject({ code: 'ProcessingError' })
    expect(error.message).toBe('something unexpected happened')
  })

  it('falls back to a ProcessingError with the exit code', () => {
    const error = toFfmpegError({ stdout: '', stderr: '', exitCode: 5 })
    expect(error.message).toContain('code 5')
  })
})
