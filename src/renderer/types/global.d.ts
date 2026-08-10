import type { PreloadApi } from '../../shared/types/preload'

declare global {
  interface Window {
    mediaDownloader: PreloadApi
  }
}

export {}
