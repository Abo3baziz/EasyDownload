import { describe, expect, it, vi } from 'vitest'
import type { ProcessManager, ProcessResult } from '../process/process-manager'
import { createDependencyManager } from './dependency-manager'

function successResult(stdout: string): ProcessResult {
  return { stdout, stderr: '', exitCode: 0, timedOut: false }
}

function createMockProcesses(result?: ProcessResult, error?: Error): ProcessManager {
  const runToCompletion = vi.fn()
  if (error) {
    runToCompletion.mockRejectedValue(error)
  } else {
    runToCompletion.mockResolvedValue(result)
  }
  return { runToCompletion } as unknown as ProcessManager
}

describe('createDependencyManager', () => {
  it('checks yt-dlp with --version and reports the first stdout line as the version', async () => {
    const processes = createMockProcesses(successResult('2025.01.15\n'))
    const manager = createDependencyManager(processes)

    await expect(manager.checkYtDlp()).resolves.toEqual({
      name: 'yt-dlp',
      available: true,
      version: '2025.01.15'
    })
    expect(processes.runToCompletion).toHaveBeenCalledWith('yt-dlp', {
      args: ['--version'],
      timeoutMs: 5000
    })
  })

  it('checks ffmpeg with -version', async () => {
    const processes = createMockProcesses(successResult('ffmpeg version 6.1.1-full_build-www.gyan.dev\n'))
    const manager = createDependencyManager(processes)

    await expect(manager.checkFfmpeg()).resolves.toEqual({
      name: 'ffmpeg',
      available: true,
      version: 'ffmpeg version 6.1.1-full_build-www.gyan.dev'
    })
    expect(processes.runToCompletion).toHaveBeenCalledWith('ffmpeg', {
      args: ['-version'],
      timeoutMs: 5000
    })
  })

  it('reports an unavailable dependency when the process exits non-zero', async () => {
    const processes = createMockProcesses({ stdout: '', stderr: '', exitCode: 8, timedOut: false })
    const manager = createDependencyManager(processes)

    await expect(manager.checkFfmpeg()).resolves.toEqual({ name: 'ffmpeg', available: false })
  })

  it('reports an unavailable dependency when the process times out', async () => {
    const processes = createMockProcesses({
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: true
    })
    const manager = createDependencyManager(processes)

    await expect(manager.checkYtDlp()).resolves.toEqual({ name: 'yt-dlp', available: false })
  })

  it('reports an unavailable dependency when spawning fails', async () => {
    const processes = createMockProcesses(undefined, new Error('spawn ffmpeg ENOENT'))
    const manager = createDependencyManager(processes)

    await expect(manager.checkFfmpeg()).resolves.toEqual({ name: 'ffmpeg', available: false })
  })

  it('respects custom commands and timeout', async () => {
    const processes = createMockProcesses(successResult('v1'))
    const manager = createDependencyManager(processes, {
      ytDlpCommand: '/opt/bin/yt-dlp',
      ffmpegCommand: '/opt/bin/ffmpeg',
      timeoutMs: 1000
    })

    await manager.checkAll()
    expect(processes.runToCompletion).toHaveBeenCalledWith('/opt/bin/yt-dlp', {
      args: ['--version'],
      timeoutMs: 1000
    })
    expect(processes.runToCompletion).toHaveBeenCalledWith('/opt/bin/ffmpeg', {
      args: ['-version'],
      timeoutMs: 1000
    })
  })

  it('checkAll checks yt-dlp then ffmpeg', async () => {
    const processes = createMockProcesses(successResult('v1'))
    const manager = createDependencyManager(processes)

    await expect(manager.checkAll()).resolves.toEqual([
      { name: 'yt-dlp', available: true, version: 'v1' },
      { name: 'ffmpeg', available: true, version: 'v1' }
    ])
    expect(processes.runToCompletion).toHaveBeenNthCalledWith(1, 'yt-dlp', {
      args: ['--version'],
      timeoutMs: 5000
    })
    expect(processes.runToCompletion).toHaveBeenNthCalledWith(2, 'ffmpeg', {
      args: ['-version'],
      timeoutMs: 5000
    })
  })
})
