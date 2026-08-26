import type { DependencyName, DependencyStatus } from '../../../shared/types/dependencies'
import type { ProcessManager } from '../process/process-manager'

export interface DependencyManager {
  checkYtDlp(): Promise<DependencyStatus>
  checkFfmpeg(): Promise<DependencyStatus>
  checkAll(): Promise<DependencyStatus[]>
}

export interface DependencyManagerOptions {
  ytDlpCommand?: string
  ffmpegCommand?: string
  timeoutMs?: number
}

export function createDependencyManager(
  processes: ProcessManager,
  options: DependencyManagerOptions = {}
): DependencyManager {
  const ytDlpCommand = options.ytDlpCommand ?? 'yt-dlp'
  const ffmpegCommand = options.ffmpegCommand ?? 'ffmpeg'
  const timeoutMs = options.timeoutMs ?? 5000
  const cache = new Map<DependencyName, DependencyStatus>()

  async function check(
    name: DependencyName,
    command: string,
    versionArgs: readonly string[]
  ): Promise<DependencyStatus> {
    try {
      const result = await processes.runToCompletion(command, {
        args: [...versionArgs],
        timeoutMs
      })
      if (result.exitCode !== 0 || result.timedOut) {
        return { name, available: false }
      }
      return { name, available: true, version: parseVersion(result.stdout) }
    } catch {
      return { name, available: false }
    }
  }

  async function checkCached(
    name: DependencyName,
    command: string,
    versionArgs: readonly string[]
  ): Promise<DependencyStatus> {
    const cached = cache.get(name)
    if (cached?.available) {
      return cached
    }
    const status = await check(name, command, versionArgs)
    if (status.available) {
      cache.set(name, status)
    }
    return status
  }

  const checkYtDlp = () => checkCached('yt-dlp', ytDlpCommand, ['--version'])
  const checkFfmpeg = () => checkCached('ffmpeg', ffmpegCommand, ['-version'])

  return {
    checkYtDlp,
    checkFfmpeg,
    checkAll: () => Promise.all([checkYtDlp(), checkFfmpeg()])
  }
}

function parseVersion(stdout: string): string | undefined {
  const firstLine = stdout.split(/\r?\n/, 1)[0]?.trim()
  return firstLine === '' ? undefined : firstLine
}
