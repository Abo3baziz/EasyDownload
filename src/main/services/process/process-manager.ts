import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'

export interface RunOptions {
  args?: readonly string[]
  timeoutMs?: number
}

export interface ProcessResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}

export interface StartStreamingOptions extends RunOptions {
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
}

export interface StartedProcess {
  result: Promise<ProcessResult>
  kill(): void
}

const FORCE_KILL_GRACE_MS = 2_000

function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * Terminates the process and (on supported platforms) its whole tree.
 * `escalated` requests an immediate hard kill instead of a graceful one.
 */
function killTree(child: ChildProcess, escalated = false): void {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }
  if (!child.pid) {
    return
  }
  if (isWindows()) {
    const args = escalated
      ? ['/pid', String(child.pid), '/T', '/F']
      : ['/pid', String(child.pid), '/T']
    const killer = spawn('taskkill', args, { windowsHide: true })
    killer.on('error', () => {
      child.kill()
    })
    child.kill()
    return
  }
  try {
    process.kill(-child.pid, escalated ? 'SIGKILL' : 'SIGTERM')
  } catch {
    child.kill(escalated ? 'SIGKILL' : 'SIGTERM')
  }
}

function killWithEscalation(child: ChildProcess): void {
  killTree(child)
  const timer = setTimeout(() => {
    killTree(child, true)
  }, FORCE_KILL_GRACE_MS)
  timer.unref?.()
  child.once('close', () => {
    clearTimeout(timer)
  })
}

interface SpawnOptions {
  command: string
  args: readonly string[]
}

function createChild(options: Pick<SpawnOptions, 'command' | 'args'>) {
  return spawn(options.command, [...options.args], {
    windowsHide: true,
    detached: !isWindows()
  })
}

export class ProcessManager {
  runToCompletion(command: string, options: RunOptions = {}): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = createChild({ command, args: options.args ?? [] })
      const stdoutDecoder = new StringDecoder('utf8')
      const stderrDecoder = new StringDecoder('utf8')
      let stdout = ''
      let stderr = ''
      let settled = false
      let timedOut = false

      const timer =
        options.timeoutMs !== undefined
          ? setTimeout(() => {
              timedOut = true
              killWithEscalation(child)
            }, options.timeoutMs)
          : undefined

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += stdoutDecoder.write(chunk)
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += stderrDecoder.write(chunk)
      })

      child.on('error', (err: Error) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        reject(err)
      })

      child.on('close', (code: number | null) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        stdout += stdoutDecoder.end()
        stderr += stderrDecoder.end()
        resolve({ stdout, stderr, exitCode: code, timedOut })
      })
    })
  }

  startStreaming(command: string, options: StartStreamingOptions = {}): StartedProcess {
    const child = createChild({ command, args: options.args ?? [] })
    const stdoutDecoder = new StringDecoder('utf8')
    const stderrDecoder = new StringDecoder('utf8')
    let stdout = ''
    let stderr = ''
    let stdoutPending = ''
    let stderrPending = ''
    let settled = false
    let timedOut = false

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = stdoutDecoder.write(chunk)
      stdout += text
      stdoutPending = emitLines(stdoutPending, text, options.onStdout)
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = stderrDecoder.write(chunk)
      stderr += text
      stderrPending = emitLines(stderrPending, text, options.onStderr)
    })

    const timer =
      options.timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true
            killWithEscalation(child)
          }, options.timeoutMs)
        : undefined

    const result = new Promise<ProcessResult>((resolve, reject) => {
      child.on('error', (err: Error) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        reject(err)
      })

      child.on('close', (code: number | null) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        const stdoutTail = stdoutDecoder.end()
        const stderrTail = stderrDecoder.end()
        stdout += stdoutTail
        stderr += stderrTail
        stdoutPending = emitLines(stdoutPending, stdoutTail, options.onStdout)
        stderrPending = emitLines(stderrPending, stderrTail, options.onStderr)
        resolve({ stdout, stderr, exitCode: code, timedOut })
      })
    })

    return {
      result,
      kill: () => killWithEscalation(child)
    }
  }
}

function emitLines(
  pending: string,
  chunk: string,
  onLine: ((line: string) => void) | undefined
): string {
  let remaining = pending + chunk
  let newlineIndex = remaining.indexOf('\n')
  while (newlineIndex >= 0) {
    const line = remaining.slice(0, newlineIndex)
    remaining = remaining.slice(newlineIndex + 1)
    if (onLine) {
      onLine(line.replace(/\r$/, ''))
    }
    newlineIndex = remaining.indexOf('\n')
  }
  return remaining
}
