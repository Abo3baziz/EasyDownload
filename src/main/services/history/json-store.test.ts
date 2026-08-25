import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createJsonStore } from './json-store'

interface Record {
  id: string
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'ed-json-store-'))
  try {
    await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('createJsonStore', () => {
  it('saves and loads records', async () => {
    await withTempDir(async (dir) => {
      const store = createJsonStore<Record>({ dir, fileName: 'store.json' })

      await store.save([{ id: 'a' }])

      await expect(store.load()).resolves.toEqual([{ id: 'a' }])
    })
  })

  it('falls back to the backup file when the store file is corrupt', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'store.json'), '[{"id":"trunc', 'utf8')
      await writeFile(
        join(dir, 'store.json.bak'),
        JSON.stringify([{ id: 'backup' }]),
        'utf8'
      )
      const store = createJsonStore<Record>({ dir, fileName: 'store.json' })

      await expect(store.load()).resolves.toEqual([{ id: 'backup' }])
    })
  })

  it('throws a FilesystemError when both the store and its backup are unreadable', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'store.json'), '[{"id":"trunc', 'utf8')
      const store = createJsonStore<Record>({ dir, fileName: 'store.json' })

      await expect(store.load()).rejects.toMatchObject({ code: 'FilesystemError' })
    })
  })
})
