import type { MediaInfo } from '../../../shared/types/media'
import { isValidMediaUrl } from '../../../shared/utils/url'
import { AppError } from '../../utils/errors'
import type { DependencyManager } from '../dependencies/dependency-manager'

export interface MediaService {
  inspectUrl(url: string): Promise<MediaInfo>
}

export interface MediaServiceOptions {
  dependencies: DependencyManager
}

export function createMediaService(options: MediaServiceOptions): MediaService {
  return {
    async inspectUrl(url: string): Promise<MediaInfo> {
      if (!isValidMediaUrl(url)) {
        throw new AppError('ValidationError', 'The provided URL is not a valid HTTP(S) URL.')
      }

      const ytDlp = await options.dependencies.checkYtDlp()
      if (!ytDlp.available) {
        throw new AppError('DependencyError', 'yt-dlp is not available.')
      }

      throw new AppError(
        'NotImplementedError',
        'Media inspection is not implemented yet in the application skeleton.'
      )
    }
  }
}
