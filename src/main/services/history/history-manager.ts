import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Download } from '../../../shared/types/download'
import { AppError } from '../../utils/errors'

export interface HistoryManager {
  load(): Promise<Download[]>
  save(downloads: Download[]): Promise<void>
}

export interface HistoryManagerOptions {
  dir: string
  fileName?: string
}

export function createHistoryManager(options: HistoryManagerOptions): HistoryManager {
  const filePath = join(options.dir, options.fileName ?? 'history.json')

  async function load(): Promise<Download[]> {
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as Download[]
      return Array.isArray(parsed) ? parsed : []
    } catch (err) {
      if (isMissingFileError(err)) {
        return []
      }
      throw new AppError('FilesystemError', 'Failed to read download history.', describeError(err))
    }
  }

  async function save(downloads: Download[]): Promise<void> {
    try {
      await mkdir(options.dir, { recursive: true })
      await writeFile(filePath, JSON.stringify(downloads, null, 2), 'utf8')
    } catch (err) {
      throw new AppError('FilesystemError', 'Failed to write download history.', describeError(err))
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
