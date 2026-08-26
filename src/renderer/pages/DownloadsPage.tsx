import { useEffect, useState } from 'react'
import type { Conversion, ConversionStartOptions } from '../../shared/types/conversion'
import type { AppError } from '../../shared/types/errors'
import type { IpcResult } from '../../shared/types/ipc'
import type { Download, DownloadStatus } from '../../shared/types/download'
import { ConversionControl } from '../components/ConversionControl'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { MediaThumbnail } from '../components/MediaThumbnail'
import { StatusBadge } from '../components/StatusBadge'
import { hasTerminalStatus, useDownloadsData, useDownloadMeta } from '../state/downloadState'
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
  const { downloads, replaceDownloads } = useDownloadsData()
  const { error: loadError } = useDownloadMeta()
  const [conversions, setConversions] = useState<Record<string, Conversion>>({})
  const [startingConversions, setStartingConversions] = useState<ReadonlySet<string>>(new Set())
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

  async function runAction(action: () => Promise<IpcResult<unknown>>): Promise<void> {
    try {
      const result = await action()
      if (!result.ok) {
        setError(result.error)
      }
    } catch (err) {
      setError({
        code: 'UnknownError',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const handleCancel = (download: Download) =>
    runAction(() => api.cancelDownload(download.id))

  const handleCancelPlaylist = (playlistId: string) =>
    runAction(() => api.cancelPlaylist(playlistId))

  const handlePause = (download: Download) => runAction(() => api.pauseDownload(download.id))

  const handleResume = (download: Download) => runAction(() => api.resumeDownload(download.id))

  const handleRetry = (download: Download) => runAction(() => api.retryDownload(download.id))

  const handleOpenConversion = (path: string) => runAction(() => api.openFile(path))

  const handleOpenFileLocation = (path: string) => runAction(() => api.openFileLocation(path))

  async function handleDelete(download: Download) {
    await runAction(async () => {
      const result = await api.deleteDownload(download.id)
      if (!result.ok) {
        return result
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
      return result
    })
  }

  const handleOpenFile = (download: Download) => {
    if (!download.destination) return
    void runAction(() => api.openFile(download.destination!))
  }

  async function handleStartConversion(
    download: Download,
    options: Omit<ConversionStartOptions, 'input'>
  ) {
    const input = download.destination
    if (!input) return
    if (startingConversions.has(input)) return
    setStartingConversions((previous) => new Set(previous).add(input))
    try {
      await runAction(() =>
        api.startConversion({
          ...options,
          input,
          title: download.title,
          thumbnail: download.thumbnail,
          duration: download.duration
        })
      )
    } finally {
      setStartingConversions((previous) => {
        const next = new Set(previous)
        next.delete(input)
        return next
      })
    }
  }

  const handleCancelConversion = (id: string) => runAction(() => api.cancelConversion(id))

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
    startingConversions,
    playlistProgress: downloads,
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
  const hasHistory = hasTerminalStatus(downloads)
  const header = (
    <div className="page-header">
      <h1>{definition.title}</h1>
      {section === 'downloads' && hasHistory && (
        <button type="button" className="btn" onClick={() => void handleClearHistory()}>
          Clear history
        </button>
      )}
    </div>
  )
  const alerts = (
    <>
      {loadError && <ErrorAlert error={loadError} />}
      {error && <ErrorAlert error={error} />}
    </>
  )

  if (items.length === 0) {
    return (
      <section className="page">
        {alerts}
        {header}
        <EmptyState message={definition.emptyMessage} />
      </section>
    )
  }

  return (
    <section className="page">
      {alerts}
      {header}
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
  startingConversions: ReadonlySet<string>
  playlistProgress: Download[]
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

interface PlaylistProgress {
  completed: number
  total: number
}

function playlistProgressById(downloads: Download[]): Map<string, PlaylistProgress> {
  const progress = new Map<string, PlaylistProgress>()
  for (const download of downloads) {
    if (!download.playlistId) {
      continue
    }
    const entry =
      progress.get(download.playlistId) ??
      ({ completed: 0, total: download.playlistCount ?? 0 } satisfies PlaylistProgress)
    if (download.status === 'completed') {
      entry.completed += 1
    }
    if (!entry.total && download.playlistCount) {
      entry.total = download.playlistCount
    }
    progress.set(download.playlistId, entry)
  }
  return progress
}

function groupByPlaylist(downloads: Download[]): PlaylistGroupEntry[] {
  const playlists = new Map<string, PlaylistGroupEntry>()
  const groups: PlaylistGroupEntry[] = []
  for (const download of downloads) {
    if (!download.playlistId) {
      groups.push({ key: download.id, items: [download] })
      continue
    }
    let group = playlists.get(download.playlistId)
    if (!group) {
      group = {
        key: download.playlistId,
        playlistId: download.playlistId,
        playlistTitle: download.playlistTitle,
        items: []
      }
      playlists.set(download.playlistId, group)
      groups.push(group)
    }
    if (!group.playlistTitle && download.playlistTitle) {
      group.playlistTitle = download.playlistTitle
    }
    group.items.push(download)
  }
  return groups
}

function DownloadList({
  downloads,
  playlistProgress,
  onCancelPlaylist,
  ...props
}: DownloadListProps) {
  const progressById = playlistProgressById(playlistProgress)
  return (
    <ul className='download-list'>
      {groupByPlaylist(downloads).map((group) =>
        group.playlistId ? (
          <PlaylistGroup
            key={group.key}
            group={group}
            progress={progressById.get(group.playlistId)}
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
  progress,
  onCancelPlaylist,
  ...props
}: {
  group: PlaylistGroupEntry
  progress?: PlaylistProgress
  onCancelPlaylist: (playlistId: string) => void
} & Omit<DownloadListProps, 'downloads' | 'onCancelPlaylist' | 'playlistProgress'>) {
  const total = progress?.total || group.items[0]?.playlistCount || group.items.length
  const completed = progress?.completed ?? 0
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
  startingConversions: ReadonlySet<string>
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
  startingConversions,
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
          disabled={startingConversions.has(download.destination)}
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
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent !== undefined ? Math.round(percent) : undefined}
        aria-label={`${download.title ?? download.url} download progress`}
      >
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
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
