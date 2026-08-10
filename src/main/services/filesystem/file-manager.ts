import { isAbsolute, relative, resolve } from 'node:path'
import { AppError } from '../../utils/errors'

export interface FileManager {
  selectDirectory(): Promise<string | null>
  openFile(path: string): Promise<void>
  openDirectory(path: string): Promise<void>
  isPathInside(parent: string, child: string): boolean
}

export interface FileManagerDeps {
  selectDirectory: () => Promise<string | null>
  openPath: (path: string) => Promise<string>
}

export function createFileManager(deps: FileManagerDeps): FileManager {
  function isPathInside(parent: string, child: string): boolean {
    const rel = relative(resolve(parent), resolve(child))
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  }

  async function openPath(path: string): Promise<void> {
    const error = await deps.openPath(path)
    if (error !== '') {
      throw new AppError('FilesystemError', 'Failed to open the requested location.', error)
    }
  }

  return {
    selectDirectory: deps.selectDirectory,
    openFile: (path: string) => openPath(path),
    openDirectory: (path: string) => openPath(path),
    isPathInside
  }
}
