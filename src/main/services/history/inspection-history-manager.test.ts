import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJsonStore } from './json-store'
import { createInspectionHistoryManager } from './inspection-history-manager'

describe('createInspectionHistoryManager', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'inspection-history-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  function createManager(overrides: { now?: () => number } = {}) {
    return createInspectionHistoryManager({
      history: createJsonStore({ dir, fileName: 'inspection-history.json' }),
      generateId: () => 'entry-1',
      ...overrides
    })
  }

  it('returns an empty list when no history exists', async () => {
    const history = createManager()

    await expect(history.list()).resolves.toEqual([])
  })

  it('persists a new entry and loads it back after recreation', async () => {
    const history = createManager({ now: () => 1234 })

    const entry = await history.add({ url: 'https://example.com/video', thumbnail: 'https://example.com/t.jpg' })

    expect(entry).toMatchObject({
      id: 'entry-1',
      url: 'https://example.com/video',
      thumbnail: 'https://example.com/t.jpg',
      operation: 'INSPECTED',
      createdAt: 1234
    })

    const reloaded = createManager({ now: () => 1235 })
    await expect(reloaded.list()).resolves.toEqual([entry])
  })

  it('stores the absolute createdAt timestamp in the JSON file', async () => {
    const history = createManager({ now: () => 1234 })

    await history.add({ url: 'https://example.com/video' })

    const raw = await readFile(join(dir, 'inspection-history.json'), 'utf8')
    expect(raw).toContain('"createdAt": 1234')
  })

  it('emits an update event for each added entry', async () => {
    const history = createManager()
    const listener = vi.fn()
    history.onUpdate(listener)

    await history.add({ url: 'https://example.com/video' })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/video', operation: 'INSPECTED' })
    )
  })

  it('does not add or emit an entry when persistence fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mkdir(join(dir, 'inspection-history.json'))
    const history = createManager()
    const listener = vi.fn()
    history.onUpdate(listener)

    const entry = await history.add({ url: 'https://example.com/video' })

    expect(entry).toBeNull()
    expect(listener).not.toHaveBeenCalled()
    await expect(history.list()).resolves.toEqual([])
    errorSpy.mockRestore()
  })
})
