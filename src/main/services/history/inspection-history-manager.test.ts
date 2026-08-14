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

  function createManager(overrides: { now?: () => number; generateId?: () => string } = {}) {
    return createInspectionHistoryManager({
      history: createJsonStore({ dir, fileName: 'inspection-history.json' }),
      generateId: () => 'entry-1',
      ...overrides
    })
  }

  function createSequentialId(): () => string {
    let counter = 0
    return () => `entry-${++counter}`
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

  it('removes an entry and persists the deletion', async () => {
    const history = createManager({ now: () => 1234, generateId: createSequentialId() })
    const keep = await history.add({ url: 'https://example.com/keep' })
    const gone = await history.add({ url: 'https://example.com/gone' })

    const removed = await history.remove(gone!.id)

    expect(removed).toBe(true)
    await expect(history.list()).resolves.toEqual([keep])

    const reloaded = createManager({ now: () => 1235, generateId: createSequentialId() })
    await expect(reloaded.list()).resolves.toEqual([keep])
  })

  it('returns false when removing an unknown id', async () => {
    const history = createManager()
    await history.add({ url: 'https://example.com/video' })

    await expect(history.remove('missing')).resolves.toBe(false)
    await expect(history.list()).resolves.toHaveLength(1)
  })

  it('emits a delete event for the removed entry', async () => {
    const history = createManager()
    const added = await history.add({ url: 'https://example.com/video' })
    const listener = vi.fn()
    history.onDelete(listener)

    await history.remove(added!.id)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(added)
  })

  it('does not remove the entry when persistence fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const history = createManager({ generateId: createSequentialId() })
    const entry = await history.add({ url: 'https://example.com/video' })
    await history.add({ url: 'https://example.com/other' })
    const listener = vi.fn()
    history.onDelete(listener)
    await rm(join(dir, 'inspection-history.json'))
    await mkdir(join(dir, 'inspection-history.json'))

    const removed = await history.remove(entry!.id)

    expect(removed).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    await expect(history.list()).resolves.toHaveLength(2)
    errorSpy.mockRestore()
  })
})
