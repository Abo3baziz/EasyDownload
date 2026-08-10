import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppSettings } from '../../../shared/types/settings'
import { AppError } from '../../utils/errors'

export interface SettingsManager {
  load(): Promise<AppSettings>
  save(settings: AppSettings): Promise<AppSettings>
}

export interface SettingsManagerOptions {
  dir: string
  fileName?: string
  defaults: AppSettings
}

export function createSettingsManager(options: SettingsManagerOptions): SettingsManager {
  const filePath = join(options.dir, options.fileName ?? 'settings.json')

  async function load(): Promise<AppSettings> {
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return { ...options.defaults, ...parsed }
    } catch (err) {
      if (isMissingFileError(err)) {
        return options.defaults
      }
      throw new AppError('FilesystemError', 'Failed to read settings.', describeError(err))
    }
  }

  async function save(settings: AppSettings): Promise<AppSettings> {
    try {
      await mkdir(options.dir, { recursive: true })
      await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8')
      return settings
    } catch (err) {
      throw new AppError('FilesystemError', 'Failed to write settings.', describeError(err))
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
