import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileManager } from './file-manager'

const manager = createFileManager({
  selectDirectory: async () => null,
  openPath: async () => ''
})

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
})
