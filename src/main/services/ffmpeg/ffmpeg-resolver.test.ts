import { join, win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveFfmpegBinary } from './ffmpeg-resolver'

function existsFor(paths: readonly string[]): (path: string) => boolean {
  const present = new Set(paths)
  return (path) => present.has(path)
}

describe('resolveFfmpegBinary', () => {
  it('resolves the bundled binary from the resources directory when packaged', () => {
    const binary = join('/app/resources', 'bin', 'ffmpeg')
    const result = resolveFfmpegBinary(
      {
        isPackaged: true,
        resourcesPath: '/app/resources',
        appPath: '/app/resources/app.asar',
        platform: 'linux'
      },
      existsFor([binary])
    )
    expect(result).toBe(binary)
  })

  it('uses the .exe suffix on Windows', () => {
    const binary = win32.join('C:\\app\\resources', 'bin', 'ffmpeg.exe')
    const result = resolveFfmpegBinary(
      {
        isPackaged: true,
        resourcesPath: 'C:\\app\\resources',
        appPath: 'C:\\app\\resources\\app.asar',
        platform: 'win32'
      },
      existsFor([binary])
    )
    expect(result).toBe(binary)
  })

  it('resolves the bundled binary from the dev tree when not packaged', () => {
    const binary = join('/project', 'resources', 'bin', 'ffmpeg')
    const result = resolveFfmpegBinary(
      {
        isPackaged: false,
        resourcesPath: '/ignored/resources',
        appPath: '/project',
        platform: 'linux'
      },
      existsFor([binary])
    )
    expect(result).toBe(binary)
  })

  it('returns undefined when the bundled binary is missing', () => {
    const result = resolveFfmpegBinary(
      {
        isPackaged: true,
        resourcesPath: '/app/resources',
        appPath: '/app/resources/app.asar',
        platform: 'linux'
      },
      existsFor([])
    )
    expect(result).toBeUndefined()
  })
})
