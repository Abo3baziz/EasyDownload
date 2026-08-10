import { useMemo } from 'react'
import type { PreloadApi } from '../../shared/types/preload'
import { getMediaDownloaderApi } from '../services/api'

export function useMediaDownloader(): PreloadApi {
  return useMemo(() => getMediaDownloaderApi(), [])
}
