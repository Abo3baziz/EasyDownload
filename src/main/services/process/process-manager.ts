import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
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

export interface RunningProcess {
  kill(): void
  exitCode: Promise<number | null>
}

export interface StartStreamingOptions extends RunOptions {
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
}

export interface StartedProcess {
  result: Promise<ProcessResult>
  kill(): void
}

export class ProcessManager {
  runToCompletion(command: string, options: RunOptions = {}): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...(options.args ?? [])], {
        windowsHide: true,
        env: buildSpawnEnv()
      })
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
              child.kill()
            }, options.timeoutMs)
          : undefined

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += stdoutDecoder.write(chunk)
      })

      child.stderr.on('data', (chunk: Buffer) => {
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

  spawnProcess(command: string, args: readonly string[]): RunningProcess {
    const child: ChildProcessWithoutNullStreams = spawn(command, [...args], {
      windowsHide: true,
      env: buildSpawnEnv()
    })
    return {
      kill: () => child.kill(),
      exitCode: new Promise((resolve) => {
        child.on('close', (code) => resolve(code))
      })
    }
  }

  startStreaming(command: string, options: StartStreamingOptions = {}): StartedProcess {
    const child: ChildProcessWithoutNullStreams = spawn(command, [...(options.args ?? [])], {
      windowsHide: true,
      env: buildSpawnEnv()
    })
    const stdoutDecoder = new StringDecoder('utf8')
    const stderrDecoder = new StringDecoder('utf8')
    let stdout = ''
    let stderr = ''
    let stdoutPending = ''
    let stderrPending = ''
    let settled = false

    child.stdout.on('data', (chunk: Buffer) => {
      const text = stdoutDecoder.write(chunk)
      stdout += text
      stdoutPending = emitLines(stdoutPending, text, options.onStdout)
    })

    child.stderr.on('data', (chunk: Buffer) => {
      const text = stderrDecoder.write(chunk)
      stderr += text
      stderrPending = emitLines(stderrPending, text, options.onStderr)
    })

    const result = new Promise<ProcessResult>((resolve, reject) => {
      child.on('error', (err: Error) => {
        if (settled) return
        settled = true
        reject(err)
      })

      child.on('close', (code: number | null) => {
        if (settled) return
        settled = true
        const stdoutTail = stdoutDecoder.end()
        const stderrTail = stderrDecoder.end()
        stdout += stdoutTail
        stderr += stderrTail
        stdoutPending = emitLines(stdoutPending, stdoutTail, options.onStdout)
        stderrPending = emitLines(stderrPending, stderrTail, options.onStderr)
        resolve({ stdout, stderr, exitCode: code, timedOut: false })
      })
    })

    return {
      result,
      kill: () => child.kill()
    }
  }
}

function buildSpawnEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8'
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
