import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Conversion, ConversionStartOptions } from '../../../shared/types/conversion'
import type { FfmpegHandle, FfmpegService } from '../ffmpeg/ffmpeg-service'
import { createConversionManager } from './conversion-manager'

interface PendingJob {
  resolve: (value: { exitCode: number | null; stdout: string; stderr: string; cancelled: boolean }) => void
}

function createQueuingFfmpeg() {
  const pending: PendingJob[] = []
  const extractAudio = vi.fn().mockImplementation(() => {
    const handle = {
      result: new Promise((resolve) => {
        pending.push({ resolve })
      }),
      cancel: vi.fn()
    } as unknown as FfmpegHandle
    return handle
  })
  return { ffmpeg: { extractAudio } as unknown as FfmpegService & { extractAudio: Mock }, pending }
}

function startOptions(input: string): ConversionStartOptions {
  return { type: 'extractAudio', input, audioCodec: 'mp3' }
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve()
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function statusById(conversions: Conversion[], id: string): string {
  return conversions.find((conversion) => conversion.id === id)?.status ?? 'missing'
}

describe('conversion concurrency queue', () => {
  it('runs one conversion at a time by default and queues the rest', async () => {
    const { ffmpeg, pending } = createQueuingFfmpeg()
    let seq = 0
    const manager = createConversionManager({ ffmpeg, generateId: () => `cv-${++seq}` })

    await manager.start(startOptions('C:\\Downloads\\A.mp4'))
    const secondId = (await manager.start(startOptions('C:\\Downloads\\B.mp4'))).id

    let states = await manager.list()
    expect(statusById(states, secondId)).toBe('queued')
    expect(pending).toHaveLength(1)

    pending[0]!.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flushAsync()

    states = await manager.list()
    expect(statusById(states, secondId)).toBe('running')
    expect(pending).toHaveLength(2)
  })

  it('respects a configured concurrency limit', async () => {
    const { ffmpeg, pending } = createQueuingFfmpeg()
    let seq = 0
    const manager = createConversionManager({
      ffmpeg,
      generateId: () => `cv-${++seq}`,
      maxConcurrent: 2
    })

    await manager.start(startOptions('C:\\Downloads\\A.mp4'))
    await manager.start(startOptions('C:\\Downloads\\B.mp4'))
    const thirdId = (await manager.start(startOptions('C:\\Downloads\\C.mp4'))).id

    let states = await manager.list()
    expect(statusById(states, thirdId)).toBe('queued')

    pending[0]!.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    pending[1]!.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flushAsync()

    states = await manager.list()
    expect(statusById(states, thirdId)).toBe('running')
  })

  it('cancels a queued conversion without starting it', async () => {
    const { ffmpeg, pending } = createQueuingFfmpeg()
    let seq = 0
    const manager = createConversionManager({ ffmpeg, generateId: () => `cv-${++seq}` })

    await manager.start(startOptions('C:\\Downloads\\A.mp4'))
    const secondId = (await manager.start(startOptions('C:\\Downloads\\B.mp4'))).id

    const cancelled = await manager.cancel(secondId)
    expect(cancelled.status).toBe('cancelled')

    pending[0]!.resolve({ exitCode: 0, stdout: '', stderr: '', cancelled: false })
    await flushAsync()

    const states = await manager.list()
    expect(statusById(states, secondId)).toBe('cancelled')
    expect(pending).toHaveLength(1)
  })
})
