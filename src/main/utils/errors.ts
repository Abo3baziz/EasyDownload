import { ZodError } from 'zod'
import type { AppError as AppErrorPayload, ErrorCode } from '../../shared/types/errors'

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }

  toPayload(): AppErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }
  if (error instanceof ZodError) {
    return new AppError('ValidationError', 'The request payload is invalid.', {
      issues: error.issues
    })
  }
  const message = error instanceof Error ? error.message : String(error)
  return new AppError('UnknownError', message)
}
