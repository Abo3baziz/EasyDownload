import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppError } from '../../utils/errors'

export interface JsonStore<T> {
  load(): Promise<T[]>
  save(items: T[]): Promise<void>
}

export interface JsonStoreOptions {
  dir: string
  fileName: string
}

export function createJsonStore<T>(options: JsonStoreOptions): JsonStore<T> {
  const filePath = join(options.dir, options.fileName)

  async function load(): Promise<T[]> {
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as T[]
      return Array.isArray(parsed) ? parsed : []
    } catch (err) {
      if (isMissingFileError(err)) {
        return []
      }
      throw new AppError('FilesystemError', 'Failed to read the JSON store.', describeError(err))
    }
  }

  async function save(items: T[]): Promise<void> {
    try {
      await mkdir(options.dir, { recursive: true })
      await writeFile(filePath, JSON.stringify(items, null, 2), 'utf8')
    } catch (err) {
      throw new AppError('FilesystemError', 'Failed to write the JSON store.', describeError(err))
    }
  }

  return { load, save }
}

function isMissingFileError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === 'ENOENT'
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
