import { useState } from 'react'
import type { DownloadStatus } from '../../shared/types/download'
import { useDownloads } from '../hooks/useDownloads'
import type { DownloadSection } from '../pages/DownloadsPage'
import {
  CancelledIcon,
  ChevronDownIcon,
  CompletedIcon,
  DownloadIcon,
  FailedIcon,
  HistoryIcon,
  HomeIcon,
  QueueIcon,
  SettingsIcon,
  SidebarCloseIcon,
  SidebarOpenIcon
} from './icons'

export type SidebarSection = 'home' | DownloadSection | 'history' | 'settings'

const QUEUE_STATUSES: DownloadStatus[] = ['queued', 'inspecting', 'downloading', 'processing', 'paused']

const DOWNLOAD_ITEMS: ReadonlyArray<{
  id: DownloadSection
  label: string
  icon: (props: { className?: string }) => React.JSX.Element
  statuses: DownloadStatus[] | null
}> = [
  { id: 'downloads', label: 'Downloads', icon: DownloadIcon, statuses: null },
  { id: 'queue', label: 'Queue', icon: QueueIcon, statuses: QUEUE_STATUSES },
  { id: 'completed', label: 'Completed', icon: CompletedIcon, statuses: ['completed'] },
  { id: 'cancelled', label: 'Cancelled', icon: CancelledIcon, statuses: ['cancelled'] },
  { id: 'failed', label: 'Failed', icon: FailedIcon, statuses: ['failed'] }
]

interface SidebarProps {
  section: SidebarSection
  onNavigate: (section: SidebarSection) => void
}

export function Sidebar({ section, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [groupOpen, setGroupOpen] = useState(true)
  const { downloads } = useDownloads()

  const countFor = (statuses: DownloadStatus[] | null): number => {
    if (!statuses) {
      return 0
    }
    return downloads.filter((download) => statuses.includes(download.status)).length
  }

  return (
    <nav className={collapsed ? 'app-sidebar collapsed' : 'app-sidebar'} aria-label="Primary">
      <button
        type="button"
        className="sidebar-toggle"
        aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        onClick={() => setCollapsed((current) => !current)}
      >
        {collapsed ? <SidebarOpenIcon /> : <SidebarCloseIcon />}
        <span className="sidebar-label">Hide sidebar</span>
      </button>
      <ul className="sidebar-list">
        <li>
          <SidebarItem
            icon={HomeIcon}
            label="Home"
            active={section === 'home'}
            onClick={() => onNavigate('home')}
          />
        </li>
        <li className="sidebar-group">
          <button
            type="button"
            className={groupOpen ? 'sidebar-group-toggle open' : 'sidebar-group-toggle'}
            aria-expanded={groupOpen}
            aria-controls="download-sections-group"
            aria-label="Download Sections"
            onClick={() => setGroupOpen((current) => !current)}
          >
            <DownloadIcon className="sidebar-icon" />
            <span className="sidebar-label">Download Sections</span>
            <span className="sidebar-chevron">
              <ChevronDownIcon />
            </span>
          </button>
          <div
            id="download-sections-group"
            className={groupOpen ? 'sidebar-group-body open' : 'sidebar-group-body'}
          >
            <ul className="sidebar-group-items">
              {DOWNLOAD_ITEMS.map((item) => (
                <li key={item.id}>
                  <SidebarItem
                    icon={item.icon}
                    label={item.label}
                    active={section === item.id}
                    count={countFor(item.statuses)}
                    onClick={() => onNavigate(item.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </li>
        <li>
          <SidebarItem
            icon={HistoryIcon}
            label="History"
            active={section === 'history'}
            onClick={() => onNavigate('history')}
          />
        </li>
        <li>
          <SidebarItem
            icon={SettingsIcon}
            label="Settings"
            active={section === 'settings'}
            onClick={() => onNavigate('settings')}
          />
        </li>
      </ul>
    </nav>
  )
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  count,
  onClick
}: {
  icon: (props: { className?: string }) => React.JSX.Element
  label: string
  active: boolean
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={active ? 'sidebar-item active' : 'sidebar-item'}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon className="sidebar-icon" />
      <span className="sidebar-label">{label}</span>
      {count !== undefined && count > 0 && <span className="sidebar-badge">{count}</span>}
    </button>
  )
}
