import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import type { ZodType } from 'zod'
import type { IpcResult } from '../../shared/types/ipc'
import { toAppError } from '../utils/errors'

export function registerIpcHandler<TInput, TOutput>(
  ipc: IpcMain,
  channel: string,
  schema: ZodType<TInput> | undefined,
  handler: (input: TInput, event: IpcMainInvokeEvent) => Promise<TOutput>
): void {
  ipc.handle(channel, async (event, raw: unknown): Promise<IpcResult<TOutput>> => {
    try {
      const input = schema ? schema.parse(raw) : (raw as TInput)
      const data = await handler(input, event)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: toAppError(err).toPayload() }
    }
  })
}
