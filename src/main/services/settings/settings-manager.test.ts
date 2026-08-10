import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AppSettings } from '../../../shared/types/settings'
import { createSettingsManager } from './settings-manager'

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
})
