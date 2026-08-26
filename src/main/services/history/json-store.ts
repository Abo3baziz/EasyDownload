import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppError } from '../../utils/errors'
import { describeError, isMissingFileError } from '../../utils/fs-errors'
import { backupPathFor, writeFileAtomic } from '../../utils/atomic-file'

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
  const backupPath = backupPathFor(filePath)

  async function load(): Promise<T[]> {
    try {
      return parseRecords(await readFile(filePath, 'utf8')) as T[]
    } catch (err) {
      if (isMissingFileError(err)) {
        return []
      }
      try {
        return parseRecords(await readFile(backupPath, 'utf8')) as T[]
      } catch {
        throw new AppError('FilesystemError', 'Failed to read the JSON store.', describeError(err))
      }
    }
  }

  async function save(items: T[]): Promise<void> {
    try {
      await writeFileAtomic(filePath, JSON.stringify(items, null, 2))
    } catch (err) {
      throw new AppError('FilesystemError', 'Failed to write the JSON store.', describeError(err))
    }
  }

  return { load, save }
}

function parseRecords(raw: string): unknown[] {
  const parsed = JSON.parse(raw) as unknown
  return Array.isArray(parsed) ? parsed : []
}
