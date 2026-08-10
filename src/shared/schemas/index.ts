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

export type InspectUrlPayload = z.infer<typeof inspectUrlSchema>
export type DownloadOptionsPayload = z.infer<typeof downloadOptionsSchema>
export type IdPayload = z.infer<typeof idSchema>
export type PathPayload = z.infer<typeof pathSchema>
