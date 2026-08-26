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

  it('decodes non-ASCII stdout as UTF-8', async () => {
    const result = await processes.runToCompletion(process.execPath, {
      args: ['-e', 'console.log("مرحبا")']
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('مرحبا')
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

  it('decodes non-ASCII streamed lines as UTF-8', async () => {
    const lines: string[] = []
    const started = processes.startStreaming(process.execPath, {
      args: ['-e', 'console.log("مرحبا"); console.log("مرحبا")'],
      onStdout: (line) => lines.push(line)
    })

    const result = await started.result
    expect(result.exitCode).toBe(0)
    expect(lines).toEqual(['مرحبا', 'مرحبا'])
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

  it('honors timeoutMs and reports the timeout', async () => {
    const started = processes.startStreaming(process.execPath, {
      args: ['-e', 'setInterval(() => {}, 60_000)'],
      timeoutMs: 300
    })

    const result = await started.result
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).not.toBe(0)
  })

  it('kills the whole process tree when kill is called', async () => {
    const script = [
      'const { spawn } = require("node:child_process");',
      'const child = spawn(process.execPath, ["-e", "console.log(\\"GC:\\" + process.pid); setInterval(() => {}, 60000)"]);',
      'child.stdout.on("data", (c) => process.stdout.write(c));',
      'setInterval(() => {}, 60000);'
    ].join('\n')
    const lines: string[] = []
    const started = processes.startStreaming(process.execPath, {
      args: ['-e', script],
      onStdout: (line) => lines.push(line)
    })
    void started.result.catch(() => undefined)

    await waitFor(() => lines.some((line) => line.startsWith('GC:')))
    const grandchildPid = Number(lines.find((line) => line.startsWith('GC:'))!.slice(3))

    // The grandchild must be alive before we kill the tree.
    expect(() => process.kill(grandchildPid, 0)).not.toThrow()

    started.kill()
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(() => process.kill(grandchildPid, 0)).toThrow(/ESRCH/)
  }, 15_000)

  async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (!predicate()) {
      if (Date.now() > deadline) {
        throw new Error('waitFor timed out')
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
})
