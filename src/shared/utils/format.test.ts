import { describe, expect, it } from 'vitest'
import { formatBytes, formatDate, formatDuration } from './format'

describe('formatDuration', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatDuration(45)).toBe('00:45')
    expect(formatDuration(125)).toBe('02:05')
  })

  it('formats hours as h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDuration()).toBe('')
    expect(formatDuration(Number.NaN)).toBe('')
    expect(formatDuration(-1)).toBe('')
  })
})

describe('formatBytes', () => {
  it('formats byte values with the appropriate unit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2 GB')
  })

  it('returns an empty string for missing or invalid values', () => {
    expect(formatBytes()).toBe('')
    expect(formatBytes(Number.NaN)).toBe('')
    expect(formatBytes(-5)).toBe('')
  })
})

describe('formatDate', () => {
  it('formats a timestamp as YYYY-MM-DD', () => {
    expect(formatDate(Date.UTC(2026, 7, 12))).toBe('2026-08-12')
  })

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDate()).toBe('')
    expect(formatDate(Number.NaN)).toBe('')
    expect(formatDate(-1)).toBe('')
  })
})
