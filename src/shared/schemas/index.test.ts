import { describe, expect, it } from 'vitest'
import { downloadOptionsSchema, inspectUrlSchema, urlSchema } from './index'

const VALID_URL = 'https://example.com/watch?v=1'

describe('urlSchema', () => {
  it('accepts http and https URLs', () => {
    expect(urlSchema.safeParse('http://example.com/video').success).toBe(true)
    expect(urlSchema.safeParse(VALID_URL).success).toBe(true)
  })

  it.each(['file:///C:/Windows/system32/cmd.exe', 'ftp://example.com/video.mp4'])(
    'rejects non-http(s) scheme: %s',
    (value) => {
      expect(urlSchema.safeParse(value).success).toBe(false)
    }
  )
})

describe('downloadOptionsSchema', () => {
  it('rejects downloads targeting non-http(s) URLs', () => {
    const result = downloadOptionsSchema.safeParse({
      url: 'file:///etc/passwd',
      formatId: '18',
      directory: 'D:\\Downloads'
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid download options', () => {
    const result = downloadOptionsSchema.safeParse({
      url: VALID_URL,
      formatId: '18',
      directory: 'D:\\Downloads'
    })
    expect(result.success).toBe(true)
  })
})

describe('inspectUrlSchema', () => {
  it('rejects non-http(s) URLs', () => {
    expect(inspectUrlSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false)
  })
})
