import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createFileManager, isPathWithin } from './file-manager'

function createManager(overrides: {
  showItemInFolder?: (path: string) => void
  exists?: (path: string) => boolean
} = {}) {
  return createFileManager({
    selectDirectory: async () => null,
    openPath: async () => '',
    showItemInFolder: overrides.showItemInFolder ?? (() => undefined),
    exists: overrides.exists ?? (() => true)
  })
}

const manager = createManager()

describe('createFileManager', () => {
  describe('isPathInside', () => {
    const base = join('media', 'downloads')

    it('accepts paths inside the directory', () => {
      expect(manager.isPathInside(base, join(base, 'video.mp4'))).toBe(true)
      expect(manager.isPathInside(base, join(base, 'nested', 'video.mp4'))).toBe(true)
    })

    it('rejects the directory itself', () => {
      expect(manager.isPathInside(base, base)).toBe(false)
    })

    it('rejects sibling and parent paths', () => {
      expect(manager.isPathInside(base, join('media', 'other', 'video.mp4'))).toBe(false)
      expect(manager.isPathInside(base, join('media', 'video.mp4'))).toBe(false)
    })
  })

  describe('isPathWithin', () => {
    const base = join('media', 'downloads')

    it('accepts paths inside the directory', () => {
      expect(isPathWithin(base, join(base, 'video.mp4'))).toBe(true)
      expect(isPathWithin(base, join(base, 'nested', 'video.mp4'))).toBe(true)
    })

    it('accepts the directory itself', () => {
      expect(isPathWithin(base, base)).toBe(true)
    })

    it('rejects sibling and parent paths', () => {
      expect(isPathWithin(base, join('media', 'other', 'video.mp4'))).toBe(false)
      expect(isPathWithin(base, join('media', 'video.mp4'))).toBe(false)
    })

    it('rejects traversal escapes', () => {
      expect(isPathWithin(base, join(base, '..', 'secrets.txt'))).toBe(false)
    })
  })

  describe('openFileLocation', () => {
    it('shows the item in the folder when the file exists', async () => {
      const showItemInFolder = vi.fn()
      const fileManager = createManager({ showItemInFolder })

      await fileManager.openFileLocation('D:\\Downloads\\video.mp4')

      expect(showItemInFolder).toHaveBeenCalledWith('D:\\Downloads\\video.mp4')
    })

    it('throws a FilesystemError when the file is missing', async () => {
      const showItemInFolder = vi.fn()
      const fileManager = createManager({ showItemInFolder, exists: () => false })

      await expect(fileManager.openFileLocation('D:\\Downloads\\gone.mp4')).rejects.toMatchObject({
        code: 'FilesystemError'
      })
      expect(showItemInFolder).not.toHaveBeenCalled()
    })

    it('throws a FilesystemError for an empty path', async () => {
      const showItemInFolder = vi.fn()
      const fileManager = createManager({ showItemInFolder })

      await expect(fileManager.openFileLocation('')).rejects.toMatchObject({
        code: 'FilesystemError'
      })
      expect(showItemInFolder).not.toHaveBeenCalled()
    })
  })
})
