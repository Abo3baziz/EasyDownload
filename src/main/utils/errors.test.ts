import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { AppError, toAppError } from './errors'

describe('toAppError', () => {
  it('passes AppError instances through unchanged', () => {
    const original = new AppError('DownloadError', 'specific failure')
    expect(toAppError(original)).toBe(original)
  })

  it('maps ZodErrors to ValidationError', () => {
    const zodError = new ZodError([])
    expect(toAppError(zodError).code).toBe('ValidationError')
  })

  it('sanitizes unknown error messages before crossing IPC', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const payload = toAppError(new Error('EACCES: permission denied, open C:\\secret\\key.pem'))
      expect(payload.code).toBe('UnknownError')
      expect(payload.message).toBe('An unexpected internal error occurred.')
      expect(payload.message).not.toContain('key.pem')
      expect(consoleSpy).toHaveBeenCalledWith('[main] Unknown IPC error:', expect.any(String))
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('handles non-Error values', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(toAppError('plain string').code).toBe('UnknownError')
    } finally {
      vi.restoreAllMocks()
    }
  })
})
