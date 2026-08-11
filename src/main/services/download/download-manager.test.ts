import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Download, DownloadOptions } from '../../../shared/types/download'
import type { HistoryManager } from '../history/history-manager'
import type { YtDlpMedia } from '../ytdlp/types'
import type {
  DownloadMediaHandle,
  DownloadMediaOptions,
  YtDlpDownloadCallbacks
} from '../ytdlp/ytdlp-service'
import { createDownloadManager } from './download-manager'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface MockYtDlp {
  inspect: Mock<(url: string) => Promise<YtDlpMedia>>
  startDownload: Mock<
    (options: DownloadMediaOptions, callbacks?: YtDlpDownloadCallbacks) => DownloadMediaHandle
  >
}

function createMockYtDlp(): MockYtDlp {
  return {
    inspect: vi.fn(),
    startDownload: vi.fn()
  }
}

function downloadHandle(result?: {
  exitCode?: number | null
  stderr?: string
  destination?: string
  cancelled?: boolean
}) {
  const completion = deferred<{
    exitCode: number | null
    stdout: string
    stderr: string
    cancelled: boolean
    destination?: string
  }>()
  const cancel = vi.fn()
  const handle = { result: completion.promise, cancel }
  return { handle, completion, cancel }
}

const OPTIONS: DownloadOptions = {
  url: 'https://example.com/watch?v=1',
  formatId: '137',
  directory: 'D:\\Downloads'
}

function createMockHistory(records: Download[] = []) {
  const load = vi.fn().mockResolvedValue(records)
  const save = vi.fn().mockResolvedValue(undefined)
  const history = { load, save } as unknown as HistoryManager
  return { history, load, save }
}

function terminalRecord(overrides: Partial<Download> = {}): Download {
  return {
    id: 'dl-old',
    url: OPTIONS.url,
    formatId: OPTIONS.formatId,
    directory: OPTIONS.directory,
    status: 'completed',
    progress: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('createDownloadManager', () => {
  it('creates a queued download and emits an update', async () => {
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    const updates: string[] = []
    manager.onUpdate((download) => updates.push(`${download.id}:${download.status}`))

    const download = await manager.create(OPTIONS)

    expect(download).toMatchObject({
      id: 'dl-1',
      url: OPTIONS.url,
      status: 'queued',
      directory: OPTIONS.directory
    })
    expect(updates).toEqual(['dl-1:queued'])
  })

  it('runs inspection and download to completion, setting the file name', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion } = downloadHandle({
      exitCode: 0,
      destination: 'D:\\Downloads\\Example Video [abc].mp4'
    })
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\Example Video [abc].mp4'
    })
    await flush()

    expect(ytDlp.inspect).toHaveBeenCalledWith(OPTIONS.url)
    expect(ytDlp.startDownload).toHaveBeenCalledWith(
      OPTIONS,
      expect.objectContaining({
        onProgress: expect.any(Function),
        onPhase: expect.any(Function)
      })
    )

    const download = await manager.get('dl-1')
    expect(download.status).toBe('completed')
    expect(download.title).toBe('Example Video')
    expect(download.fileName).toBe('Example Video [abc].mp4')
    expect(download.destination).toBe('D:\\Downloads\\Example Video [abc].mp4')
  })

  it('keeps a second download queued while one is active and starts it afterwards', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      now: () => 0
    })
    await manager.create(OPTIONS)
    await manager.create({ ...OPTIONS, formatId: '18' })

    await manager.start('dl-1')
    await flush()

    expect(first.handle.result).toBeDefined()
    await manager.start('dl-2')
    await flush()

    expect((await manager.get('dl-2')).status).toBe('queued')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(1)

    first.completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect((await manager.get('dl-2')).status).not.toBe('queued')
  })

  it('cancels an active download and cleans up the destination', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion, cancel } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    await manager.cancel('dl-1')

    expect(cancel).toHaveBeenCalled()

    completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()

    expect((await manager.get('dl-1')).status).toBe('cancelled')
  })

  it('cancels a queued download without starting it', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    let sequence = 0
    const manager = createDownloadManager({ ytDlp, generateId: () => `dl-${++sequence}` })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '18' })

    await manager.cancel('dl-2')

    expect((await manager.get('dl-2')).status).toBe('cancelled')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(1)
  })

  it('marks a download as failed when yt-dlp exits with an error', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion } = downloadHandle({
      exitCode: 1,
      stderr: 'ERROR: [foo] 123: Unexpected failure'
    })
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    completion.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'ERROR: [foo] 123: Unexpected failure',
      cancelled: false
    })
    await flush()

    const download = await manager.get('dl-1')
    expect(download.status).toBe('failed')
    expect(download.error?.code).toBe('ProcessError')
  })

  it('marks a download as failed when inspection fails', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockRejectedValue(
      Object.assign(new Error('Unsupported URL'), { code: 'UnsupportedMediaError' })
    )
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()

    const download = await manager.get('dl-1')
    expect(download.status).toBe('failed')
    expect(ytDlp.startDownload).not.toHaveBeenCalled()
  })

  it('retries a failed download using the original configuration', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    first.completion.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'ERROR: Something failed',
      cancelled: false
    })
    await flush()
    expect((await manager.get('dl-1')).status).toBe('failed')

    await manager.retry('dl-1')
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect(ytDlp.startDownload).toHaveBeenLastCalledWith(
      OPTIONS,
      expect.objectContaining({ onProgress: expect.any(Function) })
    )
  })

  it('rejects retry for downloads that are not failed or cancelled', async () => {
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await expect(manager.retry('dl-1')).rejects.toThrow('Cannot retry a download in state "queued"')
  })

  it('requests a best-audio merge for a video-only format', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({
      id: 'abc',
      title: 'Example Video',
      formats: [{ format_id: '137', vcodec: 'avc1.640028', acodec: 'none', ext: 'mp4' }]
    })
    const { handle } = downloadHandle({
      exitCode: 0,
      destination: 'D:\\Downloads\\Example [abc].mp4'
    })
    ytDlp.startDownload.mockReturnValue(handle)
    const checkFfmpeg = vi.fn().mockResolvedValue({ name: 'ffmpeg', available: true })
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1', checkFfmpeg })

    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()

    expect(checkFfmpeg).toHaveBeenCalled()
    expect(ytDlp.startDownload).toHaveBeenCalledWith(
      {
        url: OPTIONS.url,
        formatId: '137',
        directory: OPTIONS.directory,
        mergeAudio: true,
        mergeOutputFormat: 'mp4'
      },
      expect.objectContaining({ onProgress: expect.any(Function) })
    )
  })

  it('does not request a merge for a format that already includes audio', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({
      id: 'abc',
      title: 'Example Video',
      formats: [{ format_id: '18', vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', ext: 'mp4' }]
    })
    const { handle } = downloadHandle({ exitCode: 0 })
    ytDlp.startDownload.mockReturnValue(handle)
    const checkFfmpeg = vi.fn()
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1', checkFfmpeg })

    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-1')
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledWith(
      { url: OPTIONS.url, formatId: '18', directory: OPTIONS.directory },
      expect.anything()
    )
    expect(checkFfmpeg).not.toHaveBeenCalled()
  })

  it('fails a video-only download when FFmpeg is unavailable', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({
      id: 'abc',
      title: 'Example Video',
      formats: [{ format_id: '137', vcodec: 'avc1.640028', acodec: 'none', ext: 'mp4' }]
    })
    const checkFfmpeg = vi.fn().mockResolvedValue({ name: 'ffmpeg', available: false })
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1', checkFfmpeg })

    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()

    const download = await manager.get('dl-1')
    expect(download.status).toBe('failed')
    expect(download.error?.code).toBe('DependencyError')
    expect(ytDlp.startDownload).not.toHaveBeenCalled()
  })

  it('persists a completed download to history', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion } = downloadHandle({
      exitCode: 0,
      destination: 'D:\\Downloads\\Example [abc].mp4'
    })
    ytDlp.startDownload.mockReturnValue(handle)
    const { history, save } = createMockHistory()
    const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\Example [abc].mp4'
    })
    await flush()
    await flush()

    expect((await manager.get('dl-1')).status).toBe('completed')
    expect(save).toHaveBeenCalled()
    const persisted = save.mock.calls.at(-1)?.[0] as Download[]
    expect(persisted).toEqual([
      expect.objectContaining({ id: 'dl-1', status: 'completed' })
    ])
  })

  it('loads persisted history into the job list on startup', async () => {
    const records = [terminalRecord()]
    const { history } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-new' })

    await expect(manager.list()).resolves.toHaveLength(1)
    await expect(manager.get('dl-old')).resolves.toMatchObject({
      id: 'dl-old',
      status: 'completed'
    })
  })

  it('records the file size of a completed download', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion } = downloadHandle({
      exitCode: 0,
      destination: 'D:\\Downloads\\Example [abc].mp4'
    })
    ytDlp.startDownload.mockReturnValue(handle)
    const statFile = vi.fn().mockResolvedValue({ size: 12_345 })
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1', statFile })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\Example [abc].mp4'
    })
    await flush()

    const download = await manager.get('dl-1')
    expect(download.status).toBe('completed')
    expect(download.fileSize).toBe(12_345)
    expect(statFile).toHaveBeenCalledWith('D:\\Downloads\\Example [abc].mp4')
  })

  it('retries a failed download restored from history', async () => {
    const records = [
      terminalRecord({
        id: 'dl-old',
        status: 'failed',
        error: { code: 'NetworkError', message: 'The network request failed.' }
      })
    ]
    const { history } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-new' })

    await manager.retry('dl-old')
    await flush()

    expect(ytDlp.inspect).toHaveBeenCalledWith(OPTIONS.url)
    await completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    await expect(manager.get('dl-old')).resolves.toMatchObject({ status: 'completed' })
  })

  it('clears terminal downloads from history and keeps active ones', async () => {
    const records = [terminalRecord({ id: 'dl-old' })]
    const { history, save } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()

    const remaining = await manager.clearHistory()

    expect(remaining.map((download) => download.id)).toEqual(['dl-1'])
    expect(save).toHaveBeenLastCalledWith([])
  })
})
