import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createPathGuard } from './path-guard'

const DOWNLOAD_DIRECTORY = join('media', 'downloads')

function createGuard(downloadDirectory: string = DOWNLOAD_DIRECTORY) {
  return createPathGuard({
    getDownloadDirectory: async () => downloadDirectory
  })
}

describe('createPathGuard', () => {
  it('allows the download directory itself', async () => {
    const guard = createGuard()

    await expect(guard.assertWithinDownloadDirectory(DOWNLOAD_DIRECTORY)).resolves.toBeUndefined()
  })

  it('allows paths inside the download directory', async () => {
    const guard = createGuard()

    await expect(
      guard.assertWithinDownloadDirectory(join(DOWNLOAD_DIRECTORY, 'video.mp4'))
    ).resolves.toBeUndefined()
    await expect(
      guard.assertWithinDownloadDirectory(join(DOWNLOAD_DIRECTORY, 'nested', 'audio.mp3'))
    ).resolves.toBeUndefined()
  })

  it('allows traversal segments that stay inside the directory', async () => {
    const guard = createGuard()

    await expect(
      guard.assertWithinDownloadDirectory(join(DOWNLOAD_DIRECTORY, 'sub', '..', 'video.mp4'))
    ).resolves.toBeUndefined()
  })

  it.each([
    ['parent directory', 'media'],
    ['sibling directory', join('media', 'other', 'video.mp4')],
    ['absolute outside path', join('C:', 'Windows', 'system32', 'cmd.exe')],
    ['traversal escape', join(DOWNLOAD_DIRECTORY, '..', 'secrets.txt')]
  ])('rejects %s', async (_label, path) => {
    const guard = createGuard()

    await expect(guard.assertWithinDownloadDirectory(path)).rejects.toMatchObject({
      code: 'FilesystemError',
      details: path
    })
  })
})
