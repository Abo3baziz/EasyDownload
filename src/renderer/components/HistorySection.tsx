import type { HistoryEntry } from '../../shared/types/history'
import { useHistoryState } from '../state/historyState'
import { formatEntryTime, groupHistoryByDay } from '../utils/history'
import { EmptyState } from './EmptyState'
import { MediaThumbnail } from './MediaThumbnail'

export function HistorySection() {
  const { entries, loaded, error } = useHistoryState()
  const groups = groupHistoryByDay(entries)

  return (
    <section className='history-section'>
      <h2>History</h2>
      {error && (
        <div className='alert' role='alert'>
          <strong>{error.code}</strong> {error.message}
        </div>
      )}
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
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function HistoryEntryItem({ entry }: { entry: HistoryEntry }) {
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
    </li>
  )
}
