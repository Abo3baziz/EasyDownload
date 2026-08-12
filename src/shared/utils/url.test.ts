import { describe, expect, it } from 'vitest'
import { isValidMediaUrl, normalizeUrl } from './url'

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

describe('normalizeUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://example.com/video  ')).toBe('https://example.com/video')
  })

  it('normalizes the host and scheme case', () => {
    expect(normalizeUrl('HTTPS://EXAMPLE.COM/watch?v=abc')).toBe('https://example.com/watch?v=abc')
  })

  it('normalizes a bare host to a root path', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/')
  })

  it('keeps the path and query intact', () => {
    expect(normalizeUrl('https://example.com/watch?v=abc&t=10')).toBe(
      'https://example.com/watch?v=abc&t=10'
    )
  })

  it('returns the trimmed value when the URL cannot be parsed', () => {
    expect(normalizeUrl('not a url')).toBe('not a url')
    expect(normalizeUrl('')).toBe('')
  })
})
