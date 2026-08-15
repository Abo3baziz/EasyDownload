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
  inspectPlaylist: Mock<(url: string) => Promise<YtDlpMedia>>
  startDownload: Mock<
    (options: DownloadMediaOptions, callbacks?: YtDlpDownloadCallbacks) => DownloadMediaHandle
  >
}

function createMockYtDlp(): MockYtDlp {
  return {
    inspect: vi.fn(),
    inspectPlaylist: vi.fn(),
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
    paused?: boolean
    destination?: string
  }>()
  const cancel = vi.fn()
  const pause = vi.fn()
  const handle = { result: completion.promise, pause, cancel }
  return { handle, completion, pause, cancel }
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
  await Promise.resolve()
  await Promise.resolve()
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
      now: () => 0,
      getConcurrencyLimit: () => 1
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

  it('runs two downloads concurrently and starts the third when one completes', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    const third = downloadHandle()
    ytDlp.startDownload
      .mockReturnValueOnce(first.handle)
      .mockReturnValueOnce(second.handle)
      .mockReturnValueOnce(third.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: async () => 2
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-2')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '22' })
    await manager.start('dl-3')
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect((await manager.get('dl-1')).status).toBe('downloading')
    expect((await manager.get('dl-2')).status).toBe('downloading')
    expect((await manager.get('dl-3')).status).toBe('queued')

    first.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\one.mp4'
    })
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)
    expect((await manager.get('dl-3')).status).toBe('downloading')
  })

  it('runs three downloads concurrently and keeps additional downloads queued', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    const third = downloadHandle()
    const fourth = downloadHandle()
    ytDlp.startDownload
      .mockReturnValueOnce(first.handle)
      .mockReturnValueOnce(second.handle)
      .mockReturnValueOnce(third.handle)
      .mockReturnValueOnce(fourth.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 3
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-2')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '22' })
    await manager.start('dl-3')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '139' })
    await manager.start('dl-4')
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)
    expect((await manager.get('dl-4')).status).toBe('queued')

    third.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\three.mp4'
    })
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(4)
    expect((await manager.get('dl-4')).status).toBe('downloading')
  })

  it('starts the next queued download when an active download is cancelled', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 1
    })
    await manager.create(OPTIONS)
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-1')
    await flush()
    await manager.start('dl-2')
    await flush()

    await manager.cancel('dl-1')
    first.completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()

    expect((await manager.get('dl-1')).status).toBe('cancelled')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect((await manager.get('dl-2')).status).toBe('downloading')
  })

  it('starts the next queued download when an active download fails', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 1
    })
    await manager.create(OPTIONS)
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-1')
    await flush()
    await manager.start('dl-2')
    await flush()

    first.completion.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'ERROR: Something failed',
      cancelled: false
    })
    await flush()

    expect((await manager.get('dl-1')).status).toBe('failed')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect((await manager.get('dl-2')).status).toBe('downloading')
  })

  it('re-enters a failed download into the queue when retried while others are active', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    const third = downloadHandle()
    const fourth = downloadHandle()
    ytDlp.startDownload
      .mockReturnValueOnce(first.handle)
      .mockReturnValueOnce(second.handle)
      .mockReturnValueOnce(third.handle)
      .mockReturnValueOnce(fourth.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 2
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-2')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '22' })
    await manager.start('dl-3')
    await flush()

    first.completion.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'ERROR: Something failed',
      cancelled: false
    })
    await flush()
    expect((await manager.get('dl-1')).status).toBe('failed')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)
    expect((await manager.get('dl-3')).status).toBe('downloading')

    await manager.retry('dl-1')
    await flush()
    expect((await manager.get('dl-1')).status).toBe('queued')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)

    third.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\three.mp4'
    })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(4)
    expect((await manager.get('dl-1')).status).toBe('downloading')
  })

  it('re-enters a cancelled download into the queue when retried while others are active', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    const third = downloadHandle()
    const fourth = downloadHandle()
    ytDlp.startDownload
      .mockReturnValueOnce(first.handle)
      .mockReturnValueOnce(second.handle)
      .mockReturnValueOnce(third.handle)
      .mockReturnValueOnce(fourth.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 2
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-2')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '22' })
    await manager.start('dl-3')
    await flush()

    await manager.cancel('dl-1')
    first.completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()
    expect((await manager.get('dl-1')).status).toBe('cancelled')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)
    expect((await manager.get('dl-3')).status).toBe('downloading')

    await manager.retry('dl-1')
    await flush()
    expect((await manager.get('dl-1')).status).toBe('queued')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)

    second.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\two.mp4'
    })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(4)
    expect((await manager.get('dl-1')).status).toBe('downloading')
  })

  it('frees the slot when a download pauses and resumes into the queue while others run', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    const third = downloadHandle()
    const fourth = downloadHandle()
    ytDlp.startDownload
      .mockReturnValueOnce(first.handle)
      .mockReturnValueOnce(second.handle)
      .mockReturnValueOnce(third.handle)
      .mockReturnValueOnce(fourth.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 2
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-2')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '22' })
    await manager.start('dl-3')
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)

    await manager.pause('dl-1')
    first.completion.resolve({
      exitCode: null,
      stdout: '',
      stderr: '',
      cancelled: false,
      paused: true
    })
    await flush()

    expect((await manager.get('dl-1')).status).toBe('paused')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)
    expect((await manager.get('dl-3')).status).toBe('downloading')

    await manager.resume('dl-1')
    await flush()
    expect((await manager.get('dl-1')).status).toBe('queued')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)

    second.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\two.mp4'
    })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(4)
    expect((await manager.get('dl-1')).status).toBe('downloading')
  })

  it('never exceeds the configured concurrency limit', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const handles = Array.from({ length: 5 }, () => downloadHandle())
    for (const { handle } of handles) {
      ytDlp.startDownload.mockReturnValueOnce(handle)
    }
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 2
    })
    const formatIds = ['18', '22', '139', '140', '251']
    for (let i = 0; i < formatIds.length; i += 1) {
      await manager.create({ ...OPTIONS, formatId: formatIds[i] })
      await manager.start(`dl-${i + 1}`)
      await flush()
    }
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect((await manager.get('dl-3')).status).toBe('queued')
    expect((await manager.get('dl-4')).status).toBe('queued')
    expect((await manager.get('dl-5')).status).toBe('queued')

    handles[0].completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)

    handles[1].completion.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'ERROR: Something failed',
      cancelled: false
    })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(4)

    handles[2].completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(5)

    handles[3].completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(5)
    expect((await manager.get('dl-5')).status).toBe('downloading')
  })

  it('allows creating and starting a second download while the first is still scheduling', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: async () => 2
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await manager.create({ ...OPTIONS, formatId: '18' })
    await expect(manager.start('dl-2')).resolves.toMatchObject({ status: 'queued' })
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect((await manager.get('dl-1')).status).toBe('downloading')
    expect((await manager.get('dl-2')).status).toBe('downloading')
  })

  it.each(['completed', 'failed', 'cancelled'] as const)(
    'removes a %s download from history and emits a deletion',
    async (status) => {
      const record = terminalRecord({ id: `dl-${status}`, status })
      const { history, save } = createMockHistory([record])
      const ytDlp = createMockYtDlp()
      const manager = createDownloadManager({ ytDlp, history })
      const deleted = vi.fn()
      manager.onDelete(deleted)

      await expect(manager.remove(record.id)).resolves.toEqual(record)

      expect(save).toHaveBeenLastCalledWith([])
      expect(deleted).toHaveBeenCalledWith(record)
      await expect(manager.list()).resolves.toEqual([])
    }
  )

  it('rejects deleting an active download', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()

    await expect(manager.remove('dl-1')).rejects.toThrow(
      'Cannot delete a download in state "downloading"'
    )
    await expect(manager.get('dl-1')).resolves.toMatchObject({ status: 'downloading' })
  })

  it('waits for a cancelled process to finish before deleting its history entry', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()

    await manager.cancel('dl-1')
    const removal = manager.remove('dl-1')
    await flush()

    completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })

    await expect(removal).resolves.toMatchObject({ id: 'dl-1', status: 'cancelled' })
    await expect(manager.get('dl-1')).rejects.toThrow('The download was not found.')
  })

  it('restores a deleted entry when history persistence fails', async () => {
    const record = terminalRecord({ id: 'dl-failed' })
    const { history, save } = createMockHistory([record])
    save.mockRejectedValueOnce(new Error('write failed'))
    const manager = createDownloadManager({ ytDlp: createMockYtDlp(), history })
    const deleted = vi.fn()
    manager.onDelete(deleted)

    await expect(manager.remove(record.id)).rejects.toMatchObject({ code: 'FilesystemError' })

    await expect(manager.get(record.id)).resolves.toEqual(record)
    expect(deleted).not.toHaveBeenCalled()
  })

  it('derives the completed destination from known metadata when capture failed', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({
      id: 'abc123',
      title: 'Example Video',
      formats: [{ format_id: '137', vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', ext: 'mp4' }]
    })
    const { handle, completion } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const expected = 'D:\\Downloads\\Example Video [abc123] [137].mp4'
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => 'dl-1',
      fileExists: (path) => path === expected
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    await expect(manager.get('dl-1')).resolves.toMatchObject({
      status: 'completed',
      destination: expected,
      fileName: 'Example Video [abc123] [137].mp4'
    })
  })

  it('does not store a derived destination when the file does not exist', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({
      id: 'abc123',
      title: 'Example Video',
      formats: [{ format_id: '137', vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', ext: 'mp4' }]
    })
    const { handle, completion } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => 'dl-1',
      fileExists: () => false
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flush()

    const download = await manager.get('dl-1')
    expect(download.status).toBe('completed')
    expect(download.destination).toBeUndefined()
  })

  it('backfills a stored completed download with a unique matching file', async () => {
    const record = terminalRecord({
      id: 'dl-old',
      status: 'completed',
      title: 'Example Video',
      formatId: '18',
      directory: 'D:\\Downloads',
      extension: 'mp4'
    })
    const { history, save } = createMockHistory([record])
    const manager = createDownloadManager({
      ytDlp: createMockYtDlp(),
      history,
      listDirectory: async () => ['Example Video [abc123] [18].mp4', 'Other.mp4'],
      fileExists: () => true,
      statFile: async () => ({ size: 42 })
    })

    await expect(manager.get(record.id)).resolves.toMatchObject({
      destination: 'D:\\Downloads\\Example Video [abc123] [18].mp4',
      fileName: 'Example Video [abc123] [18].mp4',
      fileSize: 42
    })
    expect(save).toHaveBeenCalledWith([
      expect.objectContaining({
        id: record.id,
        destination: 'D:\\Downloads\\Example Video [abc123] [18].mp4'
      })
    ])
  })

  it('leaves a stored completed download untouched when multiple files match', async () => {
    const record = terminalRecord({
      id: 'dl-old',
      status: 'completed',
      title: 'Example Video',
      formatId: '18',
      directory: 'D:\\Downloads',
      extension: 'mp4'
    })
    const { history, save } = createMockHistory([record])
    const manager = createDownloadManager({
      ytDlp: createMockYtDlp(),
      history,
      listDirectory: async () => [
        'Example Video [abc123] [18].mp4',
        'Example Video [def456] [18].mp4'
      ],
      fileExists: () => true
    })

    const download = await manager.get(record.id)
    expect(download).not.toHaveProperty('destination')
    expect(save).not.toHaveBeenCalled()
  })

  it('leaves a stored completed download untouched when no file matches', async () => {
    const record = terminalRecord({
      id: 'dl-old',
      status: 'completed',
      title: 'Example Video',
      formatId: '18',
      directory: 'D:\\Downloads',
      extension: 'mp4'
    })
    const { history, save } = createMockHistory([record])
    const manager = createDownloadManager({
      ytDlp: createMockYtDlp(),
      history,
      listDirectory: async () => ['Unrelated.mp4'],
      fileExists: () => true
    })

    const download = await manager.get(record.id)
    expect(download).not.toHaveProperty('destination')
    expect(save).not.toHaveBeenCalled()
  })

  it('does not start the same download twice', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const { handle, completion } = downloadHandle()
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(1)

    await expect(manager.start('dl-1')).rejects.toThrow(
      'Cannot start a download in state "downloading"'
    )
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(1)

    completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\one.mp4'
    })
    await flush()

    expect(ytDlp.startDownload).toHaveBeenCalledTimes(1)
    expect((await manager.get('dl-1')).status).toBe('completed')
  })

  it('keeps queued and active downloads consistent when listed while running', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    const third = downloadHandle()
    ytDlp.startDownload
      .mockReturnValueOnce(first.handle)
      .mockReturnValueOnce(second.handle)
      .mockReturnValueOnce(third.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 2
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-2')
    await flush()
    await manager.create({ ...OPTIONS, formatId: '22' })
    await manager.start('dl-3')
    await flush()

    const listed = await manager.list()
    expect(listed.map((download) => download.status).sort()).toEqual([
      'downloading',
      'downloading',
      'queued'
    ])
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)

    first.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\one.mp4'
    })
    await flush()
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(3)
  })

  it('does not re-cancel a retried download while its old process is still exiting', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    let sequence = 0
    const manager = createDownloadManager({
      ytDlp,
      generateId: () => `dl-${++sequence}`,
      getConcurrencyLimit: () => 1
    })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()

    await manager.cancel('dl-1')
    await manager.retry('dl-1')
    await flush()

    expect((await manager.get('dl-1')).status).toBe('queued')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(1)

    first.completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()

    expect((await manager.get('dl-1')).status).toBe('downloading')
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
  })

  it('keeps two same-video downloads with different formats independent', async () => {
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
    await manager.start('dl-2')
    await flush()

    first.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\Example Video [abc] [137].mp4'
    })
    await flush()
    second.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\Example Video [abc] [18].mp4'
    })
    await flush()

    const firstDownload = await manager.get('dl-1')
    const secondDownload = await manager.get('dl-2')
    expect(firstDownload.id).not.toBe(secondDownload.id)
    expect(firstDownload.status).toBe('completed')
    expect(secondDownload.status).toBe('completed')
    expect(firstDownload.destination).toBe('D:\\Downloads\\Example Video [abc] [137].mp4')
    expect(secondDownload.destination).toBe('D:\\Downloads\\Example Video [abc] [18].mp4')
  })

  it('cancels one of two same-video downloads without affecting the other', async () => {
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
    await manager.start('dl-2')
    await flush()

    await manager.cancel('dl-1')
    first.completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()
    second.completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\Example Video [abc] [18].mp4'
    })
    await flush()

    expect((await manager.get('dl-1')).status).toBe('cancelled')
    expect((await manager.get('dl-2')).status).toBe('completed')
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

  it('retries a cancelled download as a fresh download', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)

    await manager.start('dl-1')
    await flush()
    await manager.cancel('dl-1')
    first.completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: true })
    await flush()

    await manager.retry('dl-1')
    await flush()

    expect(ytDlp.inspect).toHaveBeenCalledTimes(2)
    expect(ytDlp.startDownload).toHaveBeenCalledTimes(2)
    expect((await manager.get('dl-1')).status).toBe('downloading')
  })

  it('pauses an active download and resumes it with continuation', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({ id: 'abc', title: 'Example Video' })
    const first = downloadHandle()
    const second = downloadHandle()
    ytDlp.startDownload.mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create(OPTIONS)
    await manager.start('dl-1')
    await flush()

    const paused = await manager.pause('dl-1')
    expect(paused.status).toBe('paused')
    expect(first.pause).toHaveBeenCalled()
    first.completion.resolve({ exitCode: null, stdout: '', stderr: '', cancelled: false })
    await flush()

    await manager.resume('dl-1')
    await flush()
    expect(ytDlp.startDownload).toHaveBeenLastCalledWith(
      { ...OPTIONS, resume: true },
      expect.anything()
    )
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

  it('captures and persists video metadata and thumbnail', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({
      id: 'abc',
      title: 'Example Video',
      thumbnail: 'https://img.example.com/thumb.jpg',
      duration: 754,
      formats: [
        {
          format_id: '137',
          vcodec: 'avc1.640028',
          acodec: 'none',
          ext: 'mp4',
          width: 1920,
          height: 1080,
          fps: 30
        }
      ]
    })
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

    const download = await manager.get('dl-1')
    expect(download).toMatchObject({
      title: 'Example Video',
      thumbnail: 'https://img.example.com/thumb.jpg',
      duration: 754,
      resolution: '1920x1080',
      extension: 'mp4',
      videoCodec: 'avc1.640028',
      audioCodec: undefined,
      fps: 30
    })
    const persisted = save.mock.calls.at(-1)?.[0] as Download[]
    expect(persisted[0]).toMatchObject({
      thumbnail: 'https://img.example.com/thumb.jpg',
      duration: 754,
      resolution: '1920x1080',
      extension: 'mp4',
      videoCodec: 'avc1.640028',
      fps: 30
    })
  })

  it('captures audio metadata for an audio-only format', async () => {
    const ytDlp = createMockYtDlp()
    ytDlp.inspect.mockResolvedValue({
      id: 'abc',
      title: 'Example Audio',
      formats: [{ format_id: '18', vcodec: 'none', acodec: 'mp4a.40.2', ext: 'm4a' }]
    })
    const { handle, completion } = downloadHandle({
      exitCode: 0,
      destination: 'D:\\Downloads\\audio.m4a'
    })
    ytDlp.startDownload.mockReturnValue(handle)
    const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })
    await manager.create({ ...OPTIONS, formatId: '18' })

    await manager.start('dl-1')
    await flush()
    completion.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      cancelled: false,
      destination: 'D:\\Downloads\\audio.m4a'
    })
    await flush()

    const download = await manager.get('dl-1')
    expect(download.extension).toBe('m4a')
    expect(download.audioCodec).toBe('mp4a.40.2')
    expect(download.videoCodec).toBeUndefined()
    expect(download.resolution).toBeUndefined()
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

  it('rejects creating a download for the same video and format when already completed', async () => {
    const records = [terminalRecord({ id: 'dl-old', status: 'completed' })]
    const { history } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-new' })

    await expect(manager.create(OPTIONS)).rejects.toThrow(
      'This video has already been downloaded in this format.'
    )
  })

  it('allows downloading the same video at a different format after completion', async () => {
    const records = [terminalRecord({ id: 'dl-old', status: 'completed' })]
    const { history } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-new' })

    const download = await manager.create({ ...OPTIONS, formatId: '18' })

    expect(download.status).toBe('queued')
    expect(download.formatId).toBe('18')
  })

  it('allows re-downloading after a failed or cancelled attempt', async () => {
    const records = [
      terminalRecord({ id: 'dl-failed', status: 'failed', formatId: '137' }),
      terminalRecord({ id: 'dl-cancelled', status: 'cancelled', formatId: '137' })
    ]
    const { history } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-new' })

    const download = await manager.create(OPTIONS)

    expect(download.status).toBe('queued')
  })

  it('allows re-downloading when the previous completed file no longer exists', async () => {
    const records = [
      terminalRecord({ id: 'dl-old', status: 'completed', destination: 'D:\\Downloads\\gone.mp4' })
    ]
    const { history } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({
      ytDlp,
      history,
      fileExists: () => false,
      generateId: () => 'dl-new'
    })

    const download = await manager.create(OPTIONS)

    expect(download.status).toBe('queued')
  })

  it('removes a completed download from history when its file no longer exists', async () => {
    const records = [
      terminalRecord({ id: 'dl-old', destination: 'D:\\Downloads\\gone.mp4' })
    ]
    const { history, save } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({
      ytDlp,
      history,
      fileExists: () => false,
      generateId: () => 'dl-new'
    })

    await expect(manager.list()).resolves.toEqual([])
    expect(save).toHaveBeenCalled()
    expect(save.mock.calls.at(-1)?.[0]).toEqual([])
  })

  it('keeps a completed download whose file still exists', async () => {
    const records = [
      terminalRecord({ id: 'dl-old', destination: 'D:\\Downloads\\video.mp4' })
    ]
    const { history, save } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({
      ytDlp,
      history,
      fileExists: () => true,
      generateId: () => 'dl-new'
    })

    await expect(manager.list()).resolves.toHaveLength(1)
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps legacy completed downloads without a stored path', async () => {
    const records = [terminalRecord({ id: 'dl-old' })]
    const { history, save } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({
      ytDlp,
      history,
      fileExists: () => false,
      generateId: () => 'dl-new'
    })

    await expect(manager.list()).resolves.toHaveLength(1)
    expect(save).not.toHaveBeenCalled()
  })

  it('does not remove failed or cancelled downloads when files are missing', async () => {
    const records = [
      terminalRecord({ id: 'dl-failed', status: 'failed' }),
      terminalRecord({ id: 'dl-cancelled', status: 'cancelled' })
    ]
    const { history, save } = createMockHistory(records)
    const ytDlp = createMockYtDlp()
    const manager = createDownloadManager({
      ytDlp,
      history,
      fileExists: () => false,
      generateId: () => 'dl-new'
    })

    await expect(manager.list()).resolves.toHaveLength(2)
    expect(save).not.toHaveBeenCalled()
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
    await manager.create({ ...OPTIONS, formatId: '18' })
    await manager.start('dl-1')
    await flush()

    const remaining = await manager.clearHistory()

    expect(remaining.map((download) => download.id)).toEqual(['dl-1'])
    expect(save).toHaveBeenLastCalledWith([])
  })

  describe('downloadPlaylist', () => {
    const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL123'
    const MEDIA_FORMATS = [
      {
        format_id: '22',
        ext: 'mp4',
        height: 720,
        width: 1280,
        vcodec: 'avc1',
        acodec: 'mp4a',
        url: 'https://example.com/22.mp4'
      }
    ]

    function playlist(...entries: Array<{ id: string; title: string; url?: string }>) {
      return {
        id: 'PL123',
        title: 'My Playlist',
        _type: 'playlist',
        entries
      }
    }

    it('creates one tagged queued job per entry and resolves the preset format at download time', async () => {
      const ytDlp = createMockYtDlp()
      ytDlp.inspectPlaylist.mockResolvedValue(
        playlist(
          { id: 'v1', title: 'Video One', url: 'https://example.com/watch?v=1' },
          { id: 'v2', title: 'Video Two', url: 'https://example.com/watch?v=2' }
        )
      )
      ytDlp.inspect.mockResolvedValue({ id: 'v1', title: 'Video One', formats: MEDIA_FORMATS })
      const { handle, completion } = downloadHandle()
      ytDlp.startDownload.mockReturnValue(handle)
      let seq = 0
      const manager = createDownloadManager({
        ytDlp,
        generateId: () => `dl-${++seq}`,
        getConcurrencyLimit: () => 1
      })

      const result = await manager.downloadPlaylist({
        url: PLAYLIST_URL,
        preset: '720',
        directory: 'D:\\Downloads'
      })
      await flush()

      expect(result).toEqual({ playlistId: 'PL123', created: 2, skipped: 0 })
      const downloads = await manager.list()
      expect(downloads).toHaveLength(2)
      expect(downloads[0]).toMatchObject({
        url: 'https://example.com/watch?v=1',
        title: 'Video One',
        status: 'downloading',
        directory: 'D:\\Downloads\\My Playlist [PL123]',
        playlistId: 'PL123',
        playlistTitle: 'My Playlist',
        playlistIndex: 1,
        playlistCount: 2,
        formatId: '22'
      })
      expect(downloads[1]).toMatchObject({
        url: 'https://example.com/watch?v=2',
        status: 'queued',
        playlistIndex: 2,
        playlistCount: 2
      })
      expect(ytDlp.startDownload).toHaveBeenCalledTimes(1)
      expect(ytDlp.startDownload.mock.calls[0][0]).toMatchObject({
        url: 'https://example.com/watch?v=1',
        formatId: '22',
        directory: 'D:\\Downloads\\My Playlist [PL123]'
      })

      completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
      await flush()
    })

    it('skips already-completed entries and duplicate URLs', async () => {
      const existing = terminalRecord({ id: 'dl-old' })
      const { history } = createMockHistory([existing])
      const ytDlp = createMockYtDlp()
      ytDlp.inspectPlaylist.mockResolvedValue(
        playlist(
          { id: 'v1', title: 'Video One', url: 'https://example.com/watch?v=1' },
          { id: 'v1b', title: 'Video One Again', url: 'https://example.com/watch?v=1' },
          { id: 'v2', title: 'Video Two', url: 'https://example.com/watch?v=2' }
        )
      )
      ytDlp.inspect.mockResolvedValue({ id: 'v2', title: 'Video Two', formats: MEDIA_FORMATS })
      ytDlp.startDownload.mockReturnValue(downloadHandle().handle)
      const manager = createDownloadManager({ ytDlp, history, generateId: () => 'dl-1' })

      const result = await manager.downloadPlaylist({
        url: PLAYLIST_URL,
        preset: '720',
        directory: 'D:\\Downloads'
      })

      expect(result).toEqual({ playlistId: 'PL123', created: 1, skipped: 2 })
      const downloads = await manager.list()
      expect(downloads.filter((download) => download.playlistId === 'PL123')).toHaveLength(1)
      expect(
        downloads.filter((download) => download.playlistId === 'PL123').map((d) => d.url)
      ).toEqual(['https://example.com/watch?v=2'])
    })

    it('throws a clear error when the playlist has no downloadable entries', async () => {
      const ytDlp = createMockYtDlp()
      ytDlp.inspectPlaylist.mockResolvedValue(
        playlist({ id: 'v1', title: 'No Url Video' })
      )
      const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })

      await expect(
        manager.downloadPlaylist({ url: PLAYLIST_URL, preset: 'best', directory: 'D:\\Downloads' })
      ).rejects.toMatchObject({
        code: 'DownloadError',
        message: 'This playlist does not contain any downloadable videos.'
      })
    })

    it('continues with other entries when one entry fails to inspect', async () => {
      const ytDlp = createMockYtDlp()
      ytDlp.inspectPlaylist.mockResolvedValue(
        playlist(
          { id: 'v1', title: 'Video One', url: 'https://example.com/watch?v=1' },
          { id: 'v2', title: 'Video Two', url: 'https://example.com/watch?v=2' }
        )
      )
      ytDlp.inspect
        .mockRejectedValueOnce(new Error('inspection failed'))
        .mockResolvedValueOnce({ id: 'v2', title: 'Video Two', formats: MEDIA_FORMATS })
      const { handle } = downloadHandle()
      ytDlp.startDownload.mockReturnValue(handle)
      let seq = 0
      const manager = createDownloadManager({
        ytDlp,
        generateId: () => `dl-${++seq}`,
        getConcurrencyLimit: () => 2
      })

      await manager.downloadPlaylist({
        url: PLAYLIST_URL,
        preset: 'best',
        directory: 'D:\\Downloads'
      })
      await flush()

      expect((await manager.get('dl-1')).status).toBe('failed')
      expect((await manager.get('dl-2')).status).toBe('downloading')
    })

    it('retries a playlist entry whose format was never resolved', async () => {
      const ytDlp = createMockYtDlp()
      ytDlp.inspectPlaylist.mockResolvedValue(
        playlist({ id: 'v1', title: 'Video One', url: 'https://example.com/watch?v=1' })
      )
      ytDlp.inspect
        .mockRejectedValueOnce(new Error('inspection failed'))
        .mockResolvedValueOnce({ id: 'v1', title: 'Video One', formats: MEDIA_FORMATS })
      const { handle, completion } = downloadHandle()
      ytDlp.startDownload.mockReturnValue(handle)
      const manager = createDownloadManager({ ytDlp, generateId: () => 'dl-1' })

      await manager.downloadPlaylist({
        url: PLAYLIST_URL,
        preset: 'best',
        directory: 'D:\\Downloads'
      })
      await flush()

      expect((await manager.get('dl-1')).status).toBe('failed')
      expect((await manager.get('dl-1')).formatId).toBeUndefined()

      await manager.retry('dl-1')
      await flush()

      expect(ytDlp.startDownload).toHaveBeenCalledWith(
        expect.objectContaining({ formatId: '22' }),
        expect.anything()
      )
      completion.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
      await flush()
      await expect(manager.get('dl-1')).resolves.toMatchObject({ status: 'completed' })
    })

    it('cancels every non-terminal download tagged with the playlist id', async () => {
      const ytDlp = createMockYtDlp()
      ytDlp.inspectPlaylist.mockResolvedValue(
        playlist(
          { id: 'v1', title: 'Video One', url: 'https://example.com/watch?v=1' },
          { id: 'v2', title: 'Video Two', url: 'https://example.com/watch?v=2' }
        )
      )
      ytDlp.inspect.mockResolvedValue({ id: 'v1', title: 'Video One', formats: MEDIA_FORMATS })
      const single = downloadHandle()
      const first = downloadHandle()
      const second = downloadHandle()
      ytDlp.startDownload
        .mockReturnValueOnce(single.handle)
        .mockReturnValueOnce(first.handle)
        .mockReturnValueOnce(second.handle)
      let seq = 0
      const manager = createDownloadManager({
        ytDlp,
        generateId: () => `dl-${++seq}`,
        getConcurrencyLimit: () => 1
      })

      await manager.create(OPTIONS)
      await manager.start('dl-1')
      await flush()
      await manager.downloadPlaylist({
        url: PLAYLIST_URL,
        preset: '720',
        directory: 'D:\\Downloads'
      })
      await flush()

      await manager.cancelPlaylist('PL123')
      await flush()

      expect((await manager.get('dl-1')).status).toBe('downloading')
      expect((await manager.get('dl-2')).status).toBe('cancelled')
      expect((await manager.get('dl-3')).status).toBe('cancelled')
    })
  })
})
