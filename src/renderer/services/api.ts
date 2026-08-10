import type { PreloadApi } from '../../shared/types/preload'

export function getMediaDownloaderApi(): PreloadApi {
  const api = window.mediaDownloader
  if (!api) {
    throw new Error('The media downloader API is not available.')
  }
  return api
}
