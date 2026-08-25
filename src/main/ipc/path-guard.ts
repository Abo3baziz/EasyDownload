import { AppError } from '../utils/errors'
import { isPathWithin } from '../services/filesystem/file-manager'

export interface PathGuard {
  assertWithinDownloadDirectory(path: string): Promise<void>
}

export interface PathGuardDeps {
  getDownloadDirectory: () => Promise<string>
}

export function createPathGuard(deps: PathGuardDeps): PathGuard {
  async function assertWithinDownloadDirectory(path: string): Promise<void> {
    const downloadDirectory = await deps.getDownloadDirectory()
    if (!isPathWithin(downloadDirectory, path)) {
      throw new AppError(
        'FilesystemError',
        'Access to the requested path is not allowed.',
        path
      )
    }
  }

  return { assertWithinDownloadDirectory }
}
