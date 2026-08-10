import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface ResolveYtDlpBinaryInput {
  isPackaged: boolean
  resourcesPath: string
  appPath: string
  platform?: NodeJS.Platform
}

export type ExistsCheck = (path: string) => boolean

export function resolveYtDlpBinary(
  input: ResolveYtDlpBinaryInput,
  exists: ExistsCheck = existsSync
): string | undefined {
  const platform = input.platform ?? process.platform
  const binaryName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const binDir = input.isPackaged
    ? join(input.resourcesPath, 'bin')
    : join(input.appPath, 'resources', 'bin')
  const candidate = join(binDir, binaryName)
  return exists(candidate) ? candidate : undefined
}
