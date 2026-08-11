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

  return {
    checkYtDlp: () => check('yt-dlp', ytDlpCommand, ['--version']),
    checkFfmpeg: () => check('ffmpeg', ffmpegCommand, ['-version']),
    checkAll: async () => [
      await check('yt-dlp', ytDlpCommand, ['--version']),
      await check('ffmpeg', ffmpegCommand, ['-version'])
    ]
  }
}

function parseVersion(stdout: string): string | undefined {
  const firstLine = stdout.split(/\r?\n/, 1)[0]?.trim()
  return firstLine === '' ? undefined : firstLine
}
