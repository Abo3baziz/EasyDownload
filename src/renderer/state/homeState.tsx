import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { MediaInfo } from '../../shared/types/media'
import { normalizeUrl } from '../../shared/utils/url'

export interface HomeState {
  url: string
  setUrl: (url: string) => void
  clearUrl: () => void
  getInspection: (url: string) => MediaInfo | undefined
  setInspection: (url: string, media: MediaInfo) => void
}

const HomeStateContext = createContext<HomeState | null>(null)

export function HomeStateProvider({ children }: { children: ReactNode }) {
  const [url, setUrlState] = useState('')
  const [inspections, setInspections] = useState<Record<string, MediaInfo>>({})

  const setUrl = useCallback((next: string) => setUrlState(next), [])
  const clearUrl = useCallback(() => setUrlState(''), [])
  const setInspection = useCallback((inspectedUrl: string, media: MediaInfo) => {
    setInspections((previous) => ({ ...previous, [normalizeUrl(inspectedUrl)]: media }))
  }, [])
  const getInspection = useCallback(
    (candidate: string) => inspections[normalizeUrl(candidate)],
    [inspections]
  )

  const value = useMemo<HomeState>(
    () => ({ url, setUrl, clearUrl, getInspection, setInspection }),
    [url, setUrl, clearUrl, getInspection, setInspection]
  )

  return <HomeStateContext.Provider value={value}>{children}</HomeStateContext.Provider>
}

export function useHomeState(): HomeState {
  const context = useContext(HomeStateContext)
  if (!context) {
    throw new Error('useHomeState must be used within a HomeStateProvider.')
  }
  return context
}
