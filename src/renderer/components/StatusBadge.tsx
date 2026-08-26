import type { DownloadStatus } from '../../shared/types/download'

const STATUS_LABELS: Record<DownloadStatus, string> = {
  queued: 'Queued',
  inspecting: 'Inspecting',
  downloading: 'Downloading',
  processing: 'Processing',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

export function StatusBadge({ status }: { status: DownloadStatus }) {
  return (
    <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] ?? status}</span>
  )
}
