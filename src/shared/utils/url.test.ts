import { describe, expect, it } from 'vitest'
import { isValidMediaUrl } from './url'

describe('isValidMediaUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidMediaUrl('http://example.com/video')).toBe(true)
  })

  it('accepts https URLs', () => {
    expect(isValidMediaUrl('https://example.com/watch?v=abc123')).toBe(true)
  })

  it('rejects malformed URLs', () => {
    expect(isValidMediaUrl('not a url')).toBe(false)
    expect(isValidMediaUrl('')).toBe(false)
    expect(isValidMediaUrl('https://')).toBe(false)
  })

  it('rejects unsupported protocols', () => {
    expect(isValidMediaUrl('ftp://example.com/file.mp4')).toBe(false)
    expect(isValidMediaUrl('file:///tmp/video.mp4')).toBe(false)
  })
})
