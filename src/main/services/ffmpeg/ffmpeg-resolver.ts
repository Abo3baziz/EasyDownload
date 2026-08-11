import { existsSync } from 'node:fs'
import { resolveBundledBinary } from '../binary-resolver'
import type { ExistsCheck, ResolveBinaryInput } from '../binary-resolver'

export function resolveFfmpegBinary(
  input: ResolveBinaryInput,
  exists: ExistsCheck = existsSync
): string | undefined {
  const platform = input.platform ?? process.platform
  const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  return resolveBundledBinary(binaryName, input, exists)
}
