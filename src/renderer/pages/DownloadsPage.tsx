import { useEffect, useState } from 'react'
import type { Conversion, ConversionStartOptions } from '../../shared/types/conversion'
import type { AppError } from '../../shared/types/errors'
import type { Download, DownloadStatus } from '../../shared/types/download'
import { ConversionControl } from '../components/ConversionControl'
import { EmptyState } from '../components/EmptyState'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { StatusBadge } from '../components/StatusBadge'
import { useDownloads } from '../hooks/useDownloads'
import { useMediaDownloader } from '../hooks/useMediaDownloader'
import { formatBytes, formatDate, formatDuration } from '../../shared/utils/format'
import { groupByDay } from '../utils/history'

export type DownloadSection = 'downloads' | 'queue' | 'completed' | 'cancelled' | 'failed'

const SECTION_DEFINITIONS: Record<
  DownloadSection,
  { title: string; statuses: DownloadStatus[] | null; emptyMessage: string }
> = {
  downloads: {
    title: 'Downloads',
    statuses: null,
    emptyMessage: 'No downloads yet. Inspect a media URL to get started.'
  },
  queue: {
    title: 'Queue',
    statuses: ['queued', 'inspecting', 'downloading', 'processing', 'paused'],
    emptyMessage: 'No downloads in the queue.'
  },
  completed: {
    title: 'Completed',
    statuses: ['completed'],
    emptyMessage: 'No completed downloads.'
  },
  cancelled: {
    title: 'Cancelled',
    statuses: ['cancelled'],
    emptyMessage: 'No cancelled downloads.'
  },
  failed: {
    title: 'Failed',
    statuses: ['failed'],
    emptyMessage: 'No failed downloads.'
  }
}

const TERMINAL_STATUSES: DownloadStatus[] = ['completed', 'failed', 'cancelled']
const GROUPED_SECTIONS: ReadonlySet<DownloadSection> = new Set([
  'downloads',
  'completed',
  'cancelled',
  'failed'
])

export function DownloadsPage({ section }: { section: DownloadSection }) {
  const api = useMediaDownloader()
  const { downloads, error: loadError, replaceDownloads } = useDownloads()
  const [conversions, setConversions] = useState<Record<string, Conversion>>({})
  const [error, setError] = useState<AppError | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await api.listConversions()
        if (cancelled) return
        if (result.ok) {
          setConversions((previous) => {
            const next = { ...previous }
            for (const conversion of result.data) {
              next[conversion.id] = conversion
            }
            return next
          })
        } else {
          setError(result.error)
        }
      } catch (err) {
        if (cancelled) return
        setError({
          code: 'UnknownError',
          message: err instanceof Error ? err.message : String(err)
        })
      }
    })()

    const unsubscribe = api.onConversionStateChange((conversion) => {
      setConversions((previous) => ({ ...previous, [conversion.id]: conversion }))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [api])

  async function handleCancel(download: Download) {
    const result = await api.cancelDownload(download.id)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleCancelPlaylist(playlistId: string) {
    const result = await api.cancelPlaylist(playlistId)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleDelete(download: Download) {
    const result = await api.deleteDownload(download.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (download.destination) {
      setConversions((previous) => {
        const next = { ...previous }
        for (const [id, conversion] of Object.entries(next)) {
          if (conversion.input === download.destination) {
            delete next[id]
          }
        }
        return next
      })
    }
  }

  async function handlePause(download: Download) {
    const result = await api.pauseDownload(download.id)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleResume(download: Download) {
    const result = await api.resumeDownload(download.id)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleRetry(download: Download) {
    const result = await api.retryDownload(download.id)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleOpenFile(download: Download) {
    if (!download.destination) return
    const result = await api.openFile(download.destination)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleStartConversion(
    download: Download,
    options: Omit<ConversionStartOptions, 'input'>
  ) {
    if (!download.destination) return
    const result = await api.startConversion({
      ...options,
      input: download.destination,
      title: download.title,
      thumbnail: download.thumbnail,
      duration: download.duration
    })
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleCancelConversion(id: string) {
    const result = await api.cancelConversion(id)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleOpenConversion(path: string) {
    const result = await api.openFile(path)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleOpenFileLocation(path: string) {
    const result = await api.openFileLocation(path)
    if (!result.ok) {
      setError(result.error)
    }
  }

  async function handleClearHistory() {
    const result = await api.clearHistory()
    if (!result.ok) {
      setError(result.error)
      return
    }
    replaceDownloads(result.data)
    setConversions({})
  }

  const downloadListProps = {
    conversions,
    onCancel: (item: Download) => void handleCancel(item),
    onCancelPlaylist: (playlistId: string) => void handleCancelPlaylist(playlistId),
    onDelete: (item: Download) => void handleDelete(item),
    onPause: (item: Download) => void handlePause(item),
    onResume: (item: Download) => void handleResume(item),
    onRetry: (item: Download) => void handleRetry(item),
    onOpenFile: (item: Download) => void handleOpenFile(item),
    onOpenFileLocation: (path: string) => void handleOpenFileLocation(path),
    onStartConversion: (item: Download, options: Omit<ConversionStartOptions, 'input'>) =>
      void handleStartConversion(item, options),
    onCancelConversion: (id: string) => void handleCancelConversion(id),
    onOpenConversion: (path: string) => void handleOpenConversion(path)
  }
  const definition = SECTION_DEFINITIONS[section]
  const statuses = definition.statuses
  const items =
    statuses === null
      ? downloads
      : downloads.filter((download) => statuses.includes(download.status))
  const groups = GROUPED_SECTIONS.has(section) ? groupByDay(items) : undefined
  const hasHistory = downloads.some((download) => TERMINAL_STATUSES.includes(download.status))

  if (loadError) {
    return (
      <section className="page">
        <h1>{definition.title}</h1>
        <div className="alert" role="alert">
          <strong>{loadError.code}</strong> {loadError.message}
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="page">
        {error && (
          <div className="alert" role="alert">
            <strong>{error.code}</strong> {error.message}
          </div>
        )}
        <div className="page-header">
          <h1>{definition.title}</h1>
          {section === 'downloads' && hasHistory && (
            <button type="button" className="btn" onClick={() => void handleClearHistory()}>
              Clear history
            </button>
          )}
        </div>
        <EmptyState message={definition.emptyMessage} />
      </section>
    )
  }

  return (
    <section className="page">
      {error && (
        <div className="alert" role="alert">
          <strong>{error.code}</strong> {error.message}
        </div>
      )}
      <div className="page-header">
        <h1>{definition.title}</h1>
        {section === 'downloads' && hasHistory && (
          <button type="button" className="btn" onClick={() => void handleClearHistory()}>
            Clear history
          </button>
        )}
      </div>
      {groups ? (
        groups.map((group) => (
          <div key={group.key} className="history-day-group">
            <h3 className="history-day-label">{group.label}</h3>
            <DownloadList
              {...downloadListProps}
              downloads={group.entries}
            />
          </div>
        ))
      ) : (
        <DownloadList
          {...downloadListProps}
          downloads={items}
        />
      )}
    </section>
  )
}

interface DownloadListProps {
  downloads: Download[]
  conversions: Record<string, Conversion>
  onCancel: (download: Download) => void
  onCancelPlaylist: (playlistId: string) => void
  onDelete: (download: Download) => void
  onPause: (download: Download) => void
  onResume: (download: Download) => void
  onRetry: (download: Download) => void
  onOpenFile: (download: Download) => void
  onOpenFileLocation: (path: string) => void
  onStartConversion: (download: Download, options: Omit<ConversionStartOptions, 'input'>) => void
  onCancelConversion: (id: string) => void
  onOpenConversion: (path: string) => void
}

interface PlaylistGroupEntry {
  key: string
  playlistId?: string
  playlistTitle?: string
  items: Download[]
}

function groupByPlaylist(downloads: Download[]): PlaylistGroupEntry[] {
  const groups: PlaylistGroupEntry[] = []
  for (const download of downloads) {
    if (!download.playlistId) {
      groups.push({ key: download.id, items: [download] })
      continue
    }
    const last = groups[groups.length - 1]
    if (last && last.playlistId === download.playlistId) {
      last.items.push(download)
    } else {
      groups.push({
        key: download.playlistId,
        playlistId: download.playlistId,
        playlistTitle: download.playlistTitle,
        items: [download]
      })
    }
  }
  return groups
}

function DownloadList({ downloads, onCancelPlaylist, ...props }: DownloadListProps) {
  return (
    <ul className='download-list'>
      {groupByPlaylist(downloads).map((group) =>
        group.playlistId ? (
          <PlaylistGroup
            key={group.key}
            group={group}
            onCancelPlaylist={onCancelPlaylist}
            {...props}
          />
        ) : (
          <DownloadListItem
            key={group.key}
            download={group.items[0]!}
            {...props}
          />
        )
      )}
    </ul>
  )
}

function PlaylistGroup({
  group,
  onCancelPlaylist,
  ...props
}: {
  group: PlaylistGroupEntry
  onCancelPlaylist: (playlistId: string) => void
} & Omit<DownloadListProps, 'downloads' | 'onCancelPlaylist'>) {
  const total = group.items[0]?.playlistCount ?? group.items.length
  const completed = group.items.filter((download) => download.status === 'completed').length
  const activeCredit = group.items
    .filter((download) => download.status === 'downloading' || download.status === 'processing')
    .reduce((sum, download) => sum + (download.progress.percent ?? 0) / 100, 0)
  const overall =
    total > 0 ? Math.min(100, Math.round(((completed + activeCredit) / total) * 100)) : 0
  const hasActive = group.items.some((download) => canCancel(download))
  return (
    <li className='playlist-group'>
      <div className='playlist-group-header'>
        <span className='playlist-group-title'>{group.playlistTitle ?? 'Playlist'}</span>
        <span className='playlist-group-count'>
          {completed} of {total} videos · {overall}%
        </span>
        {hasActive && (
          <button
            type='button'
            className='btn'
            onClick={() => onCancelPlaylist(group.playlistId!)}>
            Cancel playlist
          </button>
        )}
      </div>
      <div className='playlist-group-progress'>
        <div className='progress-track'>
          <div
            className='progress-fill'
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>
      <ul className='download-list'>
        {group.items.map((download) => (
          <DownloadListItem
            key={download.id}
            download={download}
            {...props}
          />
        ))}
      </ul>
    </li>
  )
}

interface DownloadListItemProps {
  download: Download
  conversions: Record<string, Conversion>
  onCancel: (download: Download) => void
  onDelete: (download: Download) => void
  onPause: (download: Download) => void
  onResume: (download: Download) => void
  onRetry: (download: Download) => void
  onOpenFile: (download: Download) => void
  onOpenFileLocation: (path: string) => void
  onStartConversion: (download: Download, options: Omit<ConversionStartOptions, 'input'>) => void
  onCancelConversion: (id: string) => void
  onOpenConversion: (path: string) => void
}

function DownloadListItem({
  download,
  conversions,
  onCancel,
  onDelete,
  onPause,
  onResume,
  onRetry,
  onOpenFile,
  onOpenFileLocation,
  onStartConversion,
  onCancelConversion,
  onOpenConversion
}: DownloadListItemProps) {
  const conversion = latestConversionFor(conversions, download.destination)
  return (
    <li className="download-item">
      <div className="download-header">
        <DownloadThumbnail download={download} />
        <div className="download-main">
          <span className="download-title">{download.title ?? download.url}</span>
          <StatusBadge status={download.status} />
        </div>
      </div>
      <DownloadProgressBar download={download} />
      {download.status === 'completed' &&
        download.fileName &&
        download.fileSize !== undefined && (
          <p className="download-meta">
            {download.fileName} · {formatBytes(download.fileSize)}
          </p>
        )}
      <DownloadMetadata download={download} />
      {download.error && (
        <p className="download-error">
          {download.error.code}: {download.error.message}
        </p>
      )}
      <div className="download-actions">
        {canPause(download) && (
          <button type="button" className="btn" onClick={() => onPause(download)}>
            Pause
          </button>
        )}
        {download.status === 'paused' && (
          <button type="button" className="btn" onClick={() => onResume(download)}>
            Resume
          </button>
        )}
        {canCancel(download) && (
          <button type="button" className="btn" onClick={() => onCancel(download)}>
            Cancel
          </button>
        )}
        {canRetry(download) && (
          <button type="button" className="btn" onClick={() => onRetry(download)}>
            Retry
          </button>
        )}
        {canDelete(download) && (
          <button type="button" className="btn" onClick={() => onDelete(download)}>
            Delete
          </button>
        )}
        {download.status === 'completed' && download.destination && (
          <>
            <button type="button" className="btn" onClick={() => onOpenFile(download)}>
              Open file
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenFileLocation(download.destination!)}
            >
              Open File Location
            </button>
          </>
        )}
      </div>
      {download.status === 'completed' && download.destination && (
        <ConvertedAudioList
          conversions={conversions}
          source={download.destination}
          onOpen={(path) => onOpenConversion(path)}
          onOpenLocation={(path) => onOpenFileLocation(path)}
        />
      )}
      {download.status === 'completed' && download.destination && (
        <ConversionControl
          conversion={conversion}
          onStart={(options) => onStartConversion(download, options)}
          onCancel={(id) => onCancelConversion(id)}
        />
      )}
    </li>
  )
}

function latestConversionFor(
  conversions: Record<string, Conversion>,
  input: string | undefined
): Conversion | undefined {
  if (!input) {
    return undefined
  }
  return Object.values(conversions)
    .filter((conversion) => conversion.input === input)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

function DownloadThumbnail({ download }: { download: Download }) {
  if (download.status !== 'completed') {
    return null
  }
  return <MediaThumbnail src={download.thumbnail} alt={download.title ?? 'Video thumbnail'} />
}

function ConvertedAudioList({
  conversions,
  source,
  onOpen,
  onOpenLocation
}: {
  conversions: Record<string, Conversion>
  source: string
  onOpen: (path: string) => void
  onOpenLocation: (path: string) => void
}) {
  const items = Object.values(conversions)
    .filter(
      (conversion) =>
        conversion.type === 'extractAudio' &&
        conversion.status === 'completed' &&
        conversion.input === source
    )
    .sort((a, b) => b.createdAt - a.createdAt)
  if (items.length === 0) {
    return null
  }
  return (
    <div className="converted-list">
      <span className="converted-list-label">Converted audio</span>
      {items.map((item) => (
        <div key={item.id} className="converted-item">
          <MediaThumbnail src={item.thumbnail} alt="Converted audio thumbnail" />
          <div className="converted-main">
            <span className="download-title">{item.title ?? 'Converted audio'}</span>
            <span className="converted-metadata">
              {formatDuration(item.duration) && <span>{formatDuration(item.duration)}</span>}
              {outputFormat(item.output) && <span>{outputFormat(item.output)}</span>}
              {item.fileSize !== undefined && <span>{formatBytes(item.fileSize)}</span>}
              {formatDate(item.createdAt) && <span>{formatDate(item.createdAt)}</span>}
            </span>
          </div>
          <button type="button" className="btn" onClick={() => onOpen(item.output)}>
            Open audio file
          </button>
          <button type="button" className="btn" onClick={() => onOpenLocation(item.output)}>
            Open File Location
          </button>
        </div>
      ))}
    </div>
  )
}

function outputFormat(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) {
    return ''
  }
  return fileName.slice(dot + 1).toUpperCase()
}

function DownloadMetadata({ download }: { download: Download }) {
  if (download.status !== 'completed') {
    return null
  }
  const items: Array<{ label: string; value: string }> = []
  if (download.duration !== undefined) {
    const duration = formatDuration(download.duration)
    if (duration) {
      items.push({ label: 'Duration', value: duration })
    }
  }
  if (download.resolution) {
    items.push({ label: 'Resolution', value: download.resolution })
  }
  if (download.extension) {
    items.push({ label: 'Format', value: download.extension.toUpperCase() })
  }
  if (download.videoCodec) {
    items.push({ label: 'Video codec', value: download.videoCodec })
  }
  if (download.audioCodec) {
    items.push({ label: 'Audio codec', value: download.audioCodec })
  }
  if (download.fps !== undefined) {
    items.push({ label: 'FPS', value: String(download.fps) })
  }
  const downloaded = formatDate(download.createdAt)
  if (downloaded) {
    items.push({ label: 'Downloaded', value: downloaded })
  }
  if (items.length === 0) {
    return null
  }
  return (
    <dl className="download-metadata">
      {items.map((item) => (
        <div key={item.label} className="download-metadata-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DownloadProgressBar({ download }: { download: Download }) {
  const { percent, downloadedBytes, totalBytes, speedBytesPerSecond, etaSeconds } =
    download.progress
  const progressText: string[] = []
  if (downloadedBytes !== undefined && totalBytes !== undefined) {
    progressText.push(`${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`)
  }
  if (speedBytesPerSecond !== undefined) {
    progressText.push(`${formatBytes(speedBytesPerSecond)}/s`)
  }
  if (etaSeconds !== undefined) {
    progressText.push(`ETA ${formatDuration(etaSeconds)}`)
  }

  const isActive = ['queued', 'inspecting', 'downloading', 'processing', 'paused'].includes(
    download.status
  )
  const effectivePercent =
    percent ?? (download.playlistId !== undefined && isActive ? 0 : undefined)
  if (effectivePercent === undefined && progressText.length === 0) {
    return null
  }

  return (
    <div className="download-progress">
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, effectivePercent ?? 0))}%` }}
        />
      </div>
      <span className="progress-label">
        {effectivePercent !== undefined ? `${Math.round(effectivePercent)}%` : ''}
        {download.retryCount ? ` · Retrying (${download.retryCount})` : ''}
        {progressText.length > 0 ? ` · ${progressText.join(' · ')}` : ''}
      </span>
    </div>
  )
}

function canCancel(download: Download): boolean {
  return ['queued', 'inspecting', 'downloading', 'processing', 'paused'].includes(download.status)
}

function canPause(download: Download): boolean {
  return download.status === 'downloading' || download.status === 'processing'
}

function canRetry(download: Download): boolean {
  return download.status === 'failed' || download.status === 'cancelled'
}

function canDelete(download: Download): boolean {
  return TERMINAL_STATUSES.includes(download.status)
}
