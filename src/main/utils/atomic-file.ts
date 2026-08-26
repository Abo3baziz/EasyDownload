import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

const RETRYABLE_ERROR_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RETRY_DELAY_MS = 50

export function backupPathFor(filePath: string): string {
  return `${filePath}.bak`
}

export async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  const directory = dirname(filePath)
  await mkdir(directory, { recursive: true })

  if (existsSync(filePath)) {
    try {
      await copyFile(filePath, backupPathFor(filePath))
    } catch {
      // The backup is opportunistic; a failed backup must not block saving.
    }
  }

  const tempPath = join(directory, `.${randomUUID()}.tmp`)
  await writeFile(tempPath, contents, 'utf8')
  try {
    await renameWithRetry(tempPath, filePath)
  } catch (err) {
    await rm(tempPath, { force: true }).catch(() => undefined)
    throw err
  }
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  try {
    await rename(from, to)
  } catch (err) {
    if (!isRetryableError(err)) {
      throw err
    }
    await delay(RETRY_DELAY_MS)
    await rename(from, to)
  }
}

function isRetryableError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as NodeJS.ErrnoException).code === 'string' &&
    RETRYABLE_ERROR_CODES.has((err as NodeJS.ErrnoException).code as string)
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
