import { z } from 'zod'

export const urlSchema = z.string().url()

export const inspectUrlSchema = z
  .object({
    url: urlSchema
  })
  .strict()

export const downloadOptionsSchema = z
  .object({
    url: urlSchema,
    formatId: z.string().min(1),
    directory: z.string().min(1)
  })
  .strict()

export const idSchema = z
  .object({
    id: z.string().min(1)
  })
  .strict()

export const pathSchema = z
  .object({
    path: z.string().min(1)
  })
  .strict()

export const settingsSchema = z
  .object({
    downloadDirectory: z.string().min(1),
    notificationsEnabled: z.boolean(),
    concurrencyLimit: z.number().int().min(1).max(10)
  })
  .strict()

export const videoCodecSchema = z.enum(['copy', 'h264', 'hevc', 'vp9'])

export const audioCodecSchema = z.enum(['copy', 'mp3', 'aac', 'opus', 'flac', 'vorbis'])

export const conversionStartSchema = z
  .object({
    type: z.enum(['convert', 'extractAudio']),
    input: z.string().min(1),
    videoCodec: videoCodecSchema.optional(),
    audioCodec: audioCodecSchema.optional(),
    title: z.string().optional(),
    thumbnail: z.string().optional(),
    duration: z.number().optional()
  })
  .strict()

export type InspectUrlPayload = z.infer<typeof inspectUrlSchema>
export type DownloadOptionsPayload = z.infer<typeof downloadOptionsSchema>
export type IdPayload = z.infer<typeof idSchema>
export type PathPayload = z.infer<typeof pathSchema>
export type ConversionStartPayload = z.infer<typeof conversionStartSchema>
