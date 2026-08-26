import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { AppError } from '../../utils/errors'
import type {
  ConversionStartOptions,
  Conversion,
  ConversionProgress
} from '../../../shared/types/conversion'
import type { JsonStore } from '../history/json-store'
import type {
  FfmpegHandle,
  FfmpegService
} from '../ffmpeg/ffmpeg-service'
import { buildConversionOutputPath, createConversionManager } from './conversion-manager'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function mockHandle() {
  const completion = deferred<{
    exitCode: number | null
    stdout: string
    stderr: string
    cancelled: boolean
  }>()
  const cancel = vi.fn()
  const handle: FfmpegHandle = { result: completion.promise, cancel }
  return { handle, completion, cancel }
}

function createMockFfmpeg() {
  const convert = vi.fn()
  const extractAudio = vi.fn()
  const merge = vi.fn()
  return { convert, extractAudio, merge } as unknown as FfmpegService & {
    convert: Mock
    extractAudio: Mock
  }
}

const OPTIONS: ConversionStartOptions = {
  type: 'extractAudio',
  input: 'C:\\Downloads\\Example [abc].mp4',
  audioCodec: 'mp3'
}

function completedConversionRecord(overrides: Partial<Conversion> = {}): Conversion {
  return {
    id: 'cv-old',
    type: 'extractAudio',
    input: 'C:\\Downloads\\Example [abc].mp4',
    output: 'C:\\Downloads\\Example [abc].mp3',
    status: 'completed',
    progress: { processedMs: 0 },
    title: 'Example Video',
    thumbnail: 'https://img.example.com/thumb.jpg',
    duration: 754,
    fileSize: 5 * 1048576,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function createMockHistory(records: Conversion[] = []) {
  const load = vi.fn().mockResolvedValue(records)
  const save = vi.fn().mockResolvedValue(undefined)
  const history = { load, save } as unknown as JsonStore<Conversion>
  return { history, load, save }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('buildConversionOutputPath', () => {
  it('derives an mp3 output for audio extraction next to the input', () => {
    const output = buildConversionOutputPath(OPTIONS.input, OPTIONS)
    expect(output).toBe(join('C:\\Downloads', 'Example [abc].mp3'))
  })

  it('maps codecs to output containers', () => {
    expect(
      buildConversionOutputPath('in.mkv', { type: 'convert', videoCodec: 'h264' })
    ).toMatch(/\.mp4$/)
    expect(
      buildConversionOutputPath('in.mp4', { type: 'extractAudio', audioCodec: 'flac' })
    ).toMatch(/\.flac$/)
    expect(
      buildConversionOutputPath('in.mp4', { type: 'extractAudio', audioCodec: 'vorbis' })
    ).toMatch(/\.ogg$/)
  })

  it('never returns the input path, even when the container matches', () => {
    const output = buildConversionOutputPath('in.mp4', { type: 'convert', videoCodec: 'h264' })
    expect(output.toLowerCase()).not.toBe('in.mp4')
    expect(output).toMatch(/in \[converted\]\.mp4$/)
  })
})

describe('createConversionManager', () => {
  it('starts a conversion, derives the output, and emits an update', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    const updates: string[] = []
    manager.onUpdate((conversion) => updates.push(`${conversion.id}:${conversion.status}`))

    const conversion = await manager.start(OPTIONS)

    expect(conversion).toMatchObject({
      id: 'cv-1',
      type: 'extractAudio',
      input: OPTIONS.input,
      status: 'running',
      output: join('C:\\Downloads', 'Example [abc].mp3')
    })
    expect(updates).toEqual(['cv-1:running'])
    expect(ffmpeg.extractAudio).toHaveBeenCalledWith(
      {
        input: OPTIONS.input,
        output: join('C:\\Downloads', 'Example [abc].mp3'),
        overwrite: false,
        audioCodec: 'mp3'
      },
      expect.objectContaining({ onProgress: expect.any(Function) })
    )
  })

  it('runs a convert operation with the requested codecs', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.convert.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    const options: ConversionStartOptions = {
      type: 'convert',
      input: 'C:\\Downloads\\in.mkv',
      videoCodec: 'h264',
      audioCodec: 'copy'
    }

    await manager.start(options)

    expect(ffmpeg.convert).toHaveBeenCalledWith(
      {
        input: options.input,
        output: join('C:\\Downloads', 'in.mp4'),
        overwrite: false,
        videoCodec: 'h264',
        audioCodec: 'copy'
      },
      expect.objectContaining({ onProgress: expect.any(Function) })
    )
  })

  it('marks a conversion completed when the process succeeds', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    expect(await manager.list()).toEqual([
      expect.objectContaining({ id: 'cv-1', status: 'completed' })
    ])
  })

  it('reports progress from the FFmpeg operation', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    let onProgress: ((progress: ConversionProgress) => void) | undefined
    ffmpeg.extractAudio.mockImplementation(
      (_options: unknown, callbacks: { onProgress?: (progress: ConversionProgress) => void }) => {
        onProgress = callbacks.onProgress
        return handle
      }
    )
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    const progress: ConversionProgress[] = []
    manager.onUpdate((conversion) => progress.push(conversion.progress))
    onProgress?.({ processedMs: 500 })

    expect(progress).toContainEqual({ processedMs: 500 })

    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()
  })

  it('marks a conversion failed and maps the error', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    completion.reject(new AppError('ProcessingError', 'FFmpeg could not process the media file.'))
    await flush()

    const [conversion] = await manager.list()
    expect(conversion.status).toBe('failed')
    expect(conversion.error?.code).toBe('ProcessingError')
  })

  it('marks a cancelled conversion as cancelled', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    await manager.cancel('cv-1')

    completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()

    const [conversion] = await manager.list()
    expect(conversion.status).toBe('cancelled')
  })
  it('cancels a running conversion through its handle', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, cancel, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    await manager.cancel('cv-1')

    expect(cancel).toHaveBeenCalled()
    completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()
  })

  it('rejects cancelling a completed conversion', async () => {    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)
    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    await expect(manager.cancel('cv-1')).rejects.toThrow('Cannot cancel a conversion')
  })

  it('rejects a start when the source file does not exist', async () => {
    const ffmpeg = createMockFfmpeg()
    const statFile = vi.fn().mockResolvedValue(undefined)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1', statFile })

    await expect(manager.start(OPTIONS)).rejects.toMatchObject({ code: 'FilesystemError' })
    expect(ffmpeg.extractAudio).not.toHaveBeenCalled()
  })

  it('lists conversions in creation order', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    let sequence = 0
    const manager = createConversionManager({ ffmpeg, generateId: () => `cv-${++sequence}` })

    await manager.start(OPTIONS)
    await manager.start({
      ...OPTIONS,
      input: 'C:\\Downloads\\Other [def].mp4',
      audioCodec: 'flac'
    })

    expect((await manager.list()).map((conversion) => conversion.id)).toEqual(['cv-1', 'cv-2'])
  })

  it('persists a completed audio extraction to history', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const { history, save } = createMockHistory()
    const manager = createConversionManager({ ffmpeg, history, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()
    await flush()

    expect(save).toHaveBeenCalled()
    const persisted = save.mock.calls.at(-1)?.[0] as Conversion[]
    expect(persisted).toEqual([
      expect.objectContaining({ id: 'cv-1', type: 'extractAudio', status: 'completed' })
    ])
  })

  it('captures the metadata and file size passed from the source download', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const statFile = vi
      .fn()
      .mockResolvedValueOnce({ size: 100 })
      .mockResolvedValueOnce({ size: 5_000 })
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1', statFile })
    const options: ConversionStartOptions = {
      ...OPTIONS,
      title: 'Example Video',
      thumbnail: 'https://img.example.com/thumb.jpg',
      duration: 754
    }

    const created = await manager.start(options)
    expect(created).toMatchObject({
      title: 'Example Video',
      thumbnail: 'https://img.example.com/thumb.jpg',
      duration: 754
    })

    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    const [conversion] = await manager.list()
    expect(conversion.fileSize).toBe(5_000)
  })

  it('does not persist a failed audio extraction', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const { history, save } = createMockHistory()
    const manager = createConversionManager({ ffmpeg, history, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    completion.reject(new AppError('ProcessingError', 'FFmpeg could not process the media file.'))
    await flush()
    await flush()

    expect(save).not.toHaveBeenCalled()
  })

  it('does not persist a cancelled audio extraction', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const { history, save } = createMockHistory()
    const manager = createConversionManager({ ffmpeg, history, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    await manager.cancel('cv-1')
    completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()
    await flush()

    expect(save).not.toHaveBeenCalled()
  })

  it('does not persist video conversions', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.convert.mockReturnValue(handle)
    const { history, save } = createMockHistory()
    const manager = createConversionManager({ ffmpeg, history, generateId: () => 'cv-1' })
    await manager.start({
      type: 'convert',
      input: 'C:\\Downloads\\in.mkv',
      videoCodec: 'h264',
      audioCodec: 'copy'
    })

    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()
    await flush()

    expect(save).not.toHaveBeenCalled()
  })

  it('loads persisted conversions on startup', async () => {
    const { history } = createMockHistory([completedConversionRecord()])
    const ffmpeg = createMockFfmpeg()
    const manager = createConversionManager({ ffmpeg, history, generateId: () => 'cv-new' })

    await expect(manager.list()).resolves.toEqual([
      expect.objectContaining({ id: 'cv-old', status: 'completed' })
    ])
  })

  it('removes completed conversions linked to a download and persists the cleanup', async () => {
    const linked = completedConversionRecord({ id: 'cv-linked' })
    const unrelated = completedConversionRecord({
      id: 'cv-other',
      input: 'C:\\Downloads\\Other.mp4',
      output: 'C:\\Downloads\\Other.mp3'
    })
    const { history, save } = createMockHistory([linked, unrelated])
    const manager = createConversionManager({ ffmpeg: createMockFfmpeg(), history })

    await expect(manager.removeForInput(linked.input)).resolves.toEqual([linked])

    await expect(manager.list()).resolves.toEqual([unrelated])
    expect(save).toHaveBeenLastCalledWith([unrelated])
  })

  it('does not remove linked conversions while one is running', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    await expect(manager.removeForInput(OPTIONS.input)).rejects.toThrow(
      'Cannot delete a download while a conversion is running.'
    )
    await expect(manager.list()).resolves.toMatchObject([
      expect.objectContaining({ id: 'cv-1', status: 'running' })
    ])
  })

  it('clears persisted conversion history', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const { history, save } = createMockHistory()
    const manager = createConversionManager({ ffmpeg, history, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)
    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()
    await flush()

    const remaining = await manager.clearHistory()

    expect(remaining).toEqual([])
    expect(save).toHaveBeenLastCalledWith([])
  })

  it('shutdown cancels running conversions and waits for them to settle', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion, cancel } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const { history, save } = createMockHistory()
    const manager = createConversionManager({ ffmpeg, history, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    const shutdown = manager.shutdown()
    completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await shutdown

    expect(cancel).toHaveBeenCalled()
    await expect(manager.list()).resolves.toMatchObject([
      expect.objectContaining({ id: 'cv-1', status: 'cancelled' })
    ])
    expect(save).toHaveBeenLastCalledWith([])
  })

  it('shutdown completes when there are no running conversions', async () => {
    const manager = createConversionManager({ ffmpeg: createMockFfmpeg() })

    await expect(manager.shutdown()).resolves.toBeUndefined()
  })

  it('picks a non-colliding output path when the default already exists', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const defaultOutput = join('C:\\Downloads', 'Example [abc].mp3')
    const suffixedOutput = join('C:\\Downloads', 'Example [abc] [2].mp3')
    const manager = createConversionManager({
      ffmpeg,
      generateId: () => 'cv-1',
      fileExists: (path) => path === defaultOutput
    })

    const conversion = await manager.start(OPTIONS)

    expect(conversion.output).toBe(suffixedOutput)
    expect(ffmpeg.extractAudio).toHaveBeenCalledWith(
      expect.objectContaining({ output: suffixedOutput, overwrite: false }),
      expect.anything()
    )
  })

  it('skips multiple colliding output paths', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({
      ffmpeg,
      generateId: () => 'cv-1',
      fileExists: (path) => !/\[4\]\.mp3$/.test(path)
    })

    const conversion = await manager.start(OPTIONS)

    expect(conversion.output).toBe(join('C:\\Downloads', 'Example [abc] [4].mp3'))
  })

  it('never requests overwrite of existing output files', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.convert.mockReturnValue(handle)
    const manager = createConversionManager({
      ffmpeg,
      generateId: () => 'cv-1',
      fileExists: () => false
    })
    const options: ConversionStartOptions = {
      type: 'convert',
      input: 'C:\\Downloads\\in.mkv',
      videoCodec: 'h264'
    }

    await manager.start(options)

    expect(ffmpeg.convert).toHaveBeenCalledWith(
      expect.objectContaining({ overwrite: false }),
      expect.anything()
    )
  })

  it('deletes a partial output file when a conversion fails', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const deleteFile = vi.fn().mockResolvedValue(undefined)
    const manager = createConversionManager({
      ffmpeg,
      generateId: () => 'cv-1',
      deleteFile
    })
    await manager.start(OPTIONS)

    completion.reject(new Error('ffmpeg exploded'))
    await flush()
    await flush()

    expect(deleteFile).toHaveBeenCalledWith(join('C:\\Downloads', 'Example [abc].mp3'))
    await expect(manager.list()).resolves.toMatchObject([
      expect.objectContaining({ id: 'cv-1', status: 'failed' })
    ])
  })

  it('deletes a partial output file when a conversion is cancelled', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const deleteFile = vi.fn().mockResolvedValue(undefined)
    const manager = createConversionManager({
      ffmpeg,
      generateId: () => 'cv-1',
      deleteFile
    })
    await manager.start(OPTIONS)

    completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()
    await flush()

    expect(deleteFile).toHaveBeenCalledWith(join('C:\\Downloads', 'Example [abc].mp3'))
  })

  it('rejects a second conversion while one is running for the same input', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    await expect(manager.start(OPTIONS)).rejects.toMatchObject({
      code: 'DownloadError',
      message: expect.stringContaining('already running')
    })
    // The rejected request must not have spawned a second ffmpeg process.
    expect(ffmpeg.extractAudio).toHaveBeenCalledTimes(1)
  })

  it('allows a new conversion for the same input after the previous one finished', async () => {
    const ffmpeg = createMockFfmpeg()
    const { handle, completion } = mockHandle()
    ffmpeg.extractAudio.mockReturnValue(handle)
    const manager = createConversionManager({ ffmpeg, generateId: () => 'cv-1' })
    await manager.start(OPTIONS)

    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    await expect(manager.start(OPTIONS)).resolves.toMatchObject({ status: 'running' })
    expect(ffmpeg.extractAudio).toHaveBeenCalledTimes(2)
  })
})
