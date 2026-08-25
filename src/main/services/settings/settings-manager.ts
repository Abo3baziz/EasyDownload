import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { AppSettings } from '../../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../../shared/constants/defaults'
import { AppError } from '../../utils/errors'
import { backupPathFor, writeFileAtomic } from '../../utils/atomic-file'

export interface SettingsManager {
  load(): Promise<AppSettings>
  save(settings: AppSettings): Promise<AppSettings>
}

export interface SettingsManagerOptions {
  dir: string
  fileName?: string
  defaults: AppSettings
}

const persistedFieldSchemas = {
  downloadDirectory: z.string().min(1),
  notificationsEnabled: z.boolean(),
  concurrencyLimit: z.number().int().min(1).max(DEFAULT_SETTINGS.maxConcurrencyLimit)
} as const

export function sanitizePersistedSettings(raw: unknown): Partial<AppSettings> {
  if (typeof raw !== 'object' || raw === null) {
    return {}
  }
  const candidate = raw as Record<string, unknown>
  const clean: Partial<AppSettings> = {}
  for (const [key, schema] of Object.entries(persistedFieldSchemas)) {
    const result = schema.safeParse(candidate[key])
    if (result.success) {
      ;(clean as Record<string, unknown>)[key] = result.data
    }
  }
  return clean
}

export function createSettingsManager(options: SettingsManagerOptions): SettingsManager {
  const filePath = join(options.dir, options.fileName ?? 'settings.json')
  const backupPath = backupPathFor(filePath)

  async function load(): Promise<AppSettings> {
    try {
      return await readSettings(filePath)
    } catch (err) {
      if (isMissingFileError(err)) {
        return options.defaults
      }
      try {
        return await readSettings(backupPath)
      } catch {
        throw new AppError('FilesystemError', 'Failed to read settings.', describeError(err))
      }
    }
  }

  async function readSettings(path: string): Promise<AppSettings> {
    const raw = await readFile(path, 'utf8')
    return { ...options.defaults, ...sanitizePersistedSettings(JSON.parse(raw)) }
  }

  async function save(settings: AppSettings): Promise<AppSettings> {
    try {
      await writeFileAtomic(filePath, JSON.stringify(settings, null, 2))
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
