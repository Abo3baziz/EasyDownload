import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface ResolveBinaryInput {
  isPackaged: boolean
  resourcesPath: string
  appPath: string
  platform?: NodeJS.Platform
}

export type ExistsCheck = (path: string) => boolean

export function resolveBundledBinary(
  binaryName: string,
  input: ResolveBinaryInput,
  exists: ExistsCheck = existsSync
): string | undefined {
  const binDir = input.isPackaged
    ? join(input.resourcesPath, 'bin')
    : join(input.appPath, 'resources', 'bin')
  const candidate = join(binDir, binaryName)
  return exists(candidate) ? candidate : undefined
}
