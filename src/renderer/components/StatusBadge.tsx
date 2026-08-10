import type { DownloadStatus } from '../../shared/types/download'

export function StatusBadge({ status }: { status: DownloadStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}
