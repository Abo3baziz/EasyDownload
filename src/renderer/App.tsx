import { useState } from 'react'
import { Sidebar, type SidebarSection } from './components/Sidebar'
import { DownloadsPage, type DownloadSection } from './pages/DownloadsPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { HistoryStateProvider } from './state/historyState'
import { HomeStateProvider } from './state/homeState'

const DOWNLOAD_SECTIONS: DownloadSection[] = ['downloads', 'queue', 'completed', 'cancelled', 'failed']

function isDownloadSection(section: SidebarSection): section is DownloadSection {
  return DOWNLOAD_SECTIONS.includes(section as DownloadSection)
}

export default function App() {
  const [section, setSection] = useState<SidebarSection>('home')

  return (
    <HomeStateProvider>
      <HistoryStateProvider>
        <div className="app">
          <Sidebar section={section} onNavigate={setSection} />
          <main className="app-content">
            {section === 'home' && <HomePage />}
            {isDownloadSection(section) && <DownloadsPage section={section} />}
            {section === 'history' && <HistoryPage />}
            {section === 'settings' && <SettingsPage />}
          </main>
        </div>
      </HistoryStateProvider>
    </HomeStateProvider>
  )
}
