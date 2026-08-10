import { useState } from 'react'
import { DownloadsPage } from './pages/DownloadsPage'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'home' | 'downloads' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'settings', label: 'Settings' }
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')

  return (
    <div className="app">
      <nav className="app-nav" aria-label="Primary">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'app-nav-item active' : 'app-nav-item'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="app-content">
        {tab === 'home' && <HomePage />}
        {tab === 'downloads' && <DownloadsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
