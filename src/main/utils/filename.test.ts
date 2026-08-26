import { describe, expect, it } from 'vitest'
import { sanitizeFilename } from './filename'

describe('sanitizeFilename', () => {
  it('leaves clean titles untouched', () => {
    expect(sanitizeFilename('Me at the zoo [jNQXAC9IVRw]')).toBe('Me at the zoo [jNQXAC9IVRw]')
  })

  it.each([
    ['Video: The Movie', 'Video_ The Movie'],
    ['What is this?', 'What is this_'],
    ['a < b > c | d', 'a _ b _ c _ d'],
    ['quote"test', 'quote_test'],
    ['path\\test*star', 'path_test_star']
  ])('replaces Windows-illegal characters: %s -> %s', (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected)
  })

  it('strips trailing dots and spaces', () => {
    expect(sanitizeFilename('Title...')).toBe('Title')
    expect(sanitizeFilename('Title ')).toBe('Title')
    expect(sanitizeFilename('Title. . ')).toBe('Title')
  })

  it('replaces control characters', () => {
    expect(sanitizeFilename('bad\u0007title')).toBe('bad_title')
  })
})
