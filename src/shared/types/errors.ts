export type ErrorCode =
  | 'ValidationError'
  | 'UnsupportedMediaError'
  | 'DependencyError'
  | 'ProcessError'
  | 'NetworkError'
  | 'FilesystemError'
  | 'DownloadError'
  | 'ProcessingError'
  | 'CancellationError'
  | 'NotImplementedError'
  | 'UnknownError'

export interface AppError {
  code: ErrorCode
  message: string
  details?: unknown
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate['code'] === 'string' &&
    typeof candidate['message'] === 'string'
  )
}
