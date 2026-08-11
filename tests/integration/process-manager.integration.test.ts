import { describe, expect, it } from 'vitest'
import { ProcessManager } from '../../src/main/services/process/process-manager'

describe('ProcessManager.runToCompletion', () => {
  const processes = new ProcessManager()

  it('captures stdout and the exit code of a successful process', async () => {
    const result = await processes.runToCompletion(process.execPath, {
      args: ['-e', 'console.log("hello")']
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.timedOut).toBe(false)
  })

  it('reports a non-zero exit code for a failing process', async () => {
    const result = await processes.runToCompletion(process.execPath, {
      args: ['-e', 'process.exit(3)']
    })
    expect(result.exitCode).toBe(3)
  })

  it('captures stderr output', async () => {
    const result = await processes.runToCompletion(process.execPath, {
      args: ['-e', 'console.error("boom")']
    })
    expect(result.exitCode).toBe(0)
    expect(result.stderr.trim()).toBe('boom')
  })

  it('times out long-running processes', async () => {
    const result = await processes.runToCompletion(process.execPath, {
      args: ['-e', 'setTimeout(() => {}, 60_000)'],
      timeoutMs: 200
    })
    expect(result.timedOut).toBe(true)
  })
})

describe('ProcessManager.startStreaming', () => {
  const processes = new ProcessManager()

  it('emits stdout lines as they are produced', async () => {
    const lines: string[] = []
    const started = processes.startStreaming(process.execPath, {
      args: ['-e', 'console.log("a"); console.log("b")'],
      onStdout: (line) => lines.push(line)
    })

    const result = await started.result
    expect(result.exitCode).toBe(0)
    expect(lines).toEqual(['a', 'b'])
  })

  it('emits stderr lines separately', async () => {
    const stderr: string[] = []
    const started = processes.startStreaming(process.execPath, {
      args: ['-e', 'console.error("boom")'],
      onStderr: (line) => stderr.push(line)
    })

    const result = await started.result
    expect(result.exitCode).toBe(0)
    expect(stderr).toEqual(['boom'])
  })

  it('kills the process when kill is called', async () => {
    const started = processes.startStreaming(process.execPath, {
      args: ['-e', 'setInterval(() => {}, 1000)']
    })
    started.kill()

    const result = await started.result
    expect(result.exitCode).not.toBe(0)
  })

  it('rejects when the command cannot be launched', async () => {
    const started = processes.startStreaming('definitely-not-a-real-command-xyz', {})
    await expect(started.result).rejects.toThrow(/ENOENT/)
  })
})
