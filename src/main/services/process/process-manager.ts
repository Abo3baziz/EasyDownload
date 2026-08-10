import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'

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

export class ProcessManager {
  runToCompletion(command: string, options: RunOptions = {}): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...(options.args ?? [])], { windowsHide: true })
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
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
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
        resolve({ stdout, stderr, exitCode: code, timedOut })
      })
    })
  }

  spawnProcess(command: string, args: readonly string[]): RunningProcess {
    const child: ChildProcessWithoutNullStreams = spawn(command, [...args], {
      windowsHide: true
    })
    return {
      kill: () => child.kill(),
      exitCode: new Promise((resolve) => {
        child.on('close', (code) => resolve(code))
      })
    }
  }
}
