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
