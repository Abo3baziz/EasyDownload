export type HistoryOperation = 'INSPECTED'

export interface HistoryEntry {
  id: string
  url: string
  thumbnail?: string
  operation: HistoryOperation
  createdAt: number
}
