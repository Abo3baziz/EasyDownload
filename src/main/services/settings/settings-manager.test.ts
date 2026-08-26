import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AppSettings } from '../../../shared/types/settings'
import { createSettingsManager, sanitizePersistedSettings } from './settings-manager'

const defaults: AppSettings = {
  downloadDirectory: 'C:\\Downloads',
  notificationsEnabled: true,
  concurrencyLimit: 1
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'ed-settings-'))
  try {
    await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('createSettingsManager', () => {
  it('returns defaults when no settings file exists', async () => {
    await withTempDir(async (dir) => {
      const manager = createSettingsManager({ dir, defaults })
      await expect(manager.load()).resolves.toEqual(defaults)
    })
  })

  it('persists settings and reloads them', async () => {
    await withTempDir(async (dir) => {
      const manager = createSettingsManager({ dir, defaults })
      const updated: AppSettings = {
        downloadDirectory: 'C:\\Media',
        notificationsEnabled: false,
        concurrencyLimit: 3
      }
      await manager.save(updated)

      await expect(manager.load()).resolves.toEqual(updated)
      const raw = JSON.parse(await readFile(join(dir, 'settings.json'), 'utf8'))
      expect(raw).toEqual(updated)
    })
  })

  it('merges partial settings files over defaults', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'settings.json'),
        JSON.stringify({ concurrencyLimit: 2 }),
        'utf8'
      )
      const manager = createSettingsManager({ dir, defaults })
      await expect(manager.load()).resolves.toEqual({ ...defaults, concurrencyLimit: 2 })
    })
  })

  it('falls back to defaults per field when stored values have invalid types', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'settings.json'),
        JSON.stringify({
          downloadDirectory: '',
          notificationsEnabled: 'yes',
          concurrencyLimit: 'abc',
          unrelated: true
        }),
        'utf8'
      )
      const manager = createSettingsManager({ dir, defaults })
      await expect(manager.load()).resolves.toEqual(defaults)
    })
  })

  it('keeps valid fields while dropping invalid ones', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'settings.json'),
        JSON.stringify({
          downloadDirectory: 'C:\\Media',
          concurrencyLimit: 99
        }),
        'utf8'
      )
      const manager = createSettingsManager({ dir, defaults })
      await expect(manager.load()).resolves.toEqual({
        ...defaults,
        downloadDirectory: 'C:\\Media'
      })
    })
  })

  it('ignores non-object settings files and returns defaults', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'settings.json'), '"garbage"', 'utf8')
      const manager = createSettingsManager({ dir, defaults })
      await expect(manager.load()).resolves.toEqual(defaults)
    })
  })

  it('falls back to the backup file when the settings file is corrupt', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'settings.json'), '{"downloadDir', 'utf8')
      const backup = { downloadDirectory: 'C:\\Media', concurrencyLimit: 3 }
      await writeFile(join(dir, 'settings.json.bak'), JSON.stringify(backup), 'utf8')
      const manager = createSettingsManager({ dir, defaults })

      await expect(manager.load()).resolves.toEqual({ ...defaults, ...backup })
    })
  })

  it('serves subsequent loads from the cache instead of re-reading disk', async () => {
    await withTempDir(async (dir) => {
      const manager = createSettingsManager({ dir, defaults })
      await manager.save({ ...defaults, concurrencyLimit: 4 })

      await writeFile(
        join(dir, 'settings.json'),
        JSON.stringify({ ...defaults, concurrencyLimit: 9 }),
        'utf8'
      )

      await expect(manager.load()).resolves.toEqual({ ...defaults, concurrencyLimit: 4 })
    })
  })
})

describe('sanitizePersistedSettings', () => {
  it('accepts boundary concurrency limits', () => {
    expect(
      sanitizePersistedSettings({ concurrencyLimit: defaults.concurrencyLimit })
    ).toEqual({ concurrencyLimit: defaults.concurrencyLimit })
    expect(sanitizePersistedSettings({ concurrencyLimit: 10 })).toEqual({
      concurrencyLimit: 10
    })
  })

  it('rejects out-of-range or fractional concurrency limits', () => {
    expect(sanitizePersistedSettings({ concurrencyLimit: 0 })).toEqual({})
    expect(sanitizePersistedSettings({ concurrencyLimit: 11 })).toEqual({})
    expect(sanitizePersistedSettings({ concurrencyLimit: 2.5 })).toEqual({})
    expect(sanitizePersistedSettings({ concurrencyLimit: Number.NaN })).toEqual({})
  })
})
