import type { AppError } from './errors'

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }
