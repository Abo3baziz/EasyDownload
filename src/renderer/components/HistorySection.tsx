import { useState } from 'react'
import type { AppError } from '../../shared/types/errors'
import type { HistoryEntry } from '../../shared/types/history'
import { useHistoryState } from '../state/historyState'
import { useHomeState } from '../state/homeState'
import { formatEntryTime, groupHistoryByDay } from '../utils/history'
import { EmptyState } from './EmptyState'
import { ErrorAlert } from './ErrorAlert'
import { DeleteIcon, InspectIcon } from './icons'
import { MediaThumbnail } from './MediaThumbnail'

export function HistorySection({ onInspect }: { onInspect: (url: string) => void }) {
  const { entries, loaded, error, deleteEntry } = useHistoryState()
  const { setUrl } = useHomeState()
  const [actionError, setActionError] = useState<AppError | null>(null)
  const groups = groupHistoryByDay(entries)

  async function handleInspect(entry: HistoryEntry) {
    setActionError(null)
    setUrl(entry.url)
    onInspect(entry.url)
  }

  async function handleDelete(entry: HistoryEntry) {
    setActionError(null)
    const result = await deleteEntry(entry.id)
    if (!result.ok) {
      setActionError(result.error)
    }
  }

  return (
    <section className='history-section'>
      {error && <ErrorAlert error={error} />}
      {actionError && <ErrorAlert error={actionError} />}
      {!error && !loaded && <p className='empty-state'>Loading history…</p>}
      {!error && loaded && groups.length === 0 && (
        <EmptyState message='No history yet. URLs you inspect will appear here.' />
      )}
      {groups.map((group) => (
        <div
          key={group.key}
          className='history-day-group'>
          <h3 className='history-day-label'>{group.label}</h3>
          <ul className='history-list'>
            {group.entries.map((entry) => (
              <HistoryEntryItem
                key={entry.id}
                entry={entry}
                onInspect={() => void handleInspect(entry)}
                onDelete={() => void handleDelete(entry)}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function HistoryEntryItem({
  entry,
  onInspect,
  onDelete
}: {
  entry: HistoryEntry
  onInspect: () => void
  onDelete: () => void
}) {
  return (
    <li className='history-entry'>
      <MediaThumbnail
        src={entry.thumbnail}
        alt='URL thumbnail'
        imgClassName='history-thumbnail'
        fallbackClassName='history-thumbnail-fallback'
      />
      <div className='history-entry-main'>
        <span
          className='history-url'
          title={entry.url}>
          {entry.url}
        </span>
        <span className='history-meta'>Inspected · {formatEntryTime(entry.createdAt)}</span>
      </div>
      <div className='history-actions'>
        <button
          type='button'
          className='btn history-action-btn'
          title='Inspect this URL'
          aria-label={`Inspect ${entry.url}`}
          onClick={onInspect}>
          <InspectIcon />
          <span>Inspect</span>
        </button>
        <button
          type='button'
          className='btn history-action-btn'
          title='Delete this history entry'
          aria-label={`Delete ${entry.url}`}
          onClick={onDelete}>
          <DeleteIcon />
          <span>Delete</span>
        </button>
      </div>
    </li>
  )
}
