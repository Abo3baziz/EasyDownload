import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Download } from '../../../shared/types/download'
import { createHistoryManager } from './history-manager'

function terminalDownload(overrides: Partial<Download> = {}): Download {
  return {
    id: 'dl-1',
    url: 'https://example.com/watch?v=1',
    status: 'completed',
    progress: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

describe('createHistoryManager', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'history-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns an empty history when no file exists', async () => {
    const history = createHistoryManager({ dir })

    await expect(history.load()).resolves.toEqual([])
  })

  it('round-trips saved downloads through the file', async () => {
    const history = createHistoryManager({ dir })
    const records = [terminalDownload(), terminalDownload({ id: 'dl-2', status: 'failed' })]

    await history.save(records)

    await expect(history.load()).resolves.toEqual(records)
  })

  it('persists to the configured file name', async () => {
    const history = createHistoryManager({ dir, fileName: 'custom-history.json' })

    await history.save([terminalDownload()])

    await expect(readFile(join(dir, 'custom-history.json'), 'utf8')).resolves.toContain('dl-1')
  })

  it('returns an empty history for a non-array JSON document', async () => {
    await writeFile(join(dir, 'history.json'), '{"download": []}', 'utf8')
    const history = createHistoryManager({ dir })

    await expect(history.load()).resolves.toEqual([])
  })

  it('throws a FilesystemError for malformed JSON', async () => {
    await writeFile(join(dir, 'history.json'), '{broken', 'utf8')
    const history = createHistoryManager({ dir })

    await expect(history.load()).rejects.toMatchObject({ code: 'FilesystemError' })
  })

  it('throws a FilesystemError when the file cannot be written', async () => {
    await mkdir(join(dir, 'history.json'))
    const history = createHistoryManager({ dir })

    await expect(history.save([terminalDownload()])).rejects.toMatchObject({
      code: 'FilesystemError'
    })
  })
})
