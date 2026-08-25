import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { backupPathFor, writeFileAtomic } from './atomic-file'

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'ed-atomic-'))
  try {
    await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('writeFileAtomic', () => {
  it('writes the contents to the target file', async () => {
    await withTempDir(async (dir) => {
      const target = join(dir, 'store.json')

      await writeFileAtomic(target, '{"a":1}')

      await expect(readFile(target, 'utf8')).resolves.toBe('{"a":1}')
    })
  })

  it('creates missing parent directories', async () => {
    await withTempDir(async (dir) => {
      const target = join(dir, 'nested', 'deeper', 'store.json')

      await writeFileAtomic(target, 'data')

      await expect(readFile(target, 'utf8')).resolves.toBe('data')
    })
  })

  it('keeps the previous content as a .bak copy when overwriting', async () => {
    await withTempDir(async (dir) => {
      const target = join(dir, 'store.json')
      await writeFile(target, 'old-content', 'utf8')

      await writeFileAtomic(target, 'new-content')

      await expect(readFile(target, 'utf8')).resolves.toBe('new-content')
      await expect(readFile(backupPathFor(target), 'utf8')).resolves.toBe('old-content')
    })
  })

  it('leaves no temporary files behind', async () => {
    await withTempDir(async (dir) => {
      const target = join(dir, 'store.json')
      await writeFile(target, 'old', 'utf8')

      await writeFileAtomic(target, 'new')

      const files = await readdir(dir)
      expect(files).toEqual(['store.json', 'store.json.bak'])
    })
  })
})
