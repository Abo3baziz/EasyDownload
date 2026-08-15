import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc'
import {
  conversionStartSchema,
  downloadOptionsSchema,
  idSchema,
  inspectUrlSchema,
  pathSchema,
  playlistDownloadSchema,
  settingsSchema
} from '../../shared/schemas'
import type { InspectionResult } from '../../shared/types/media'
import type { Services } from '../services'
import { registerIpcHandler } from './handle'

export function registerIpc(services: Services): void {
  registerIpcHandler(ipcMain, IPC_CHANNELS.mediaInspect, inspectUrlSchema, async ({ url }) => {
    const result = await services.media.inspectUrl(url)
    await services.inspectionHistory.add({
      url,
      thumbnail: thumbnailOf(result)
    })
    return result
  })
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadCreate, downloadOptionsSchema, (options) =>
    services.downloads.create(options)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.playlistDownload, playlistDownloadSchema, (options) =>
    services.downloads.downloadPlaylist(options)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.playlistCancel, idSchema, ({ id }) =>
    services.downloads.cancelPlaylist(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadStart, idSchema, ({ id }) =>
    services.downloads.start(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadPause, idSchema, ({ id }) =>
    services.downloads.pause(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadResume, idSchema, ({ id }) =>
    services.downloads.resume(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadCancel, idSchema, ({ id }) =>
    services.downloads.cancel(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadDelete, idSchema, async ({ id }) => {
    const download = await services.downloads.get(id)
    if (download.status === 'completed' && download.destination) {
      await services.conversions.removeForInput(download.destination)
    }
    const removed = await services.downloads.remove(id)
    return removed !== undefined
  })
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadRetry, idSchema, ({ id }) =>
    services.downloads.retry(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadGet, idSchema, ({ id }) =>
    services.downloads.get(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadList, undefined, () =>
    services.downloads.list()
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.historyClear, undefined, async () => {
    const downloads = await services.downloads.clearHistory()
    await services.conversions.clearHistory()
    return downloads
  })
  registerIpcHandler(ipcMain, IPC_CHANNELS.dialogSelectDirectory, undefined, () =>
    services.files.selectDirectory()
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.fileOpen, pathSchema, ({ path }) =>
    services.files.openFile(path)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.fileOpenDirectory, pathSchema, ({ path }) =>
    services.files.openDirectory(path)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.fileOpenLocation, pathSchema, ({ path }) =>
    services.files.openFileLocation(path)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.settingsGet, undefined, () => services.settings.load())
  registerIpcHandler(ipcMain, IPC_CHANNELS.settingsUpdate, settingsSchema, (settings) =>
    services.settings.save(settings)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.dependenciesGet, undefined, () =>
    services.dependencies.checkAll()
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.conversionStart, conversionStartSchema, (options) =>
    services.conversions.start(options)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.conversionCancel, idSchema, ({ id }) =>
    services.conversions.cancel(id)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.conversionList, undefined, () =>
    services.conversions.list()
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.inspectionHistoryList, undefined, () =>
    services.inspectionHistory.list()
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.inspectionHistoryDelete, idSchema, ({ id }) =>
    services.inspectionHistory.remove(id)
  )

  services.downloads.onUpdate((download) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.downloadStateEvent, download)
    }
    void services.notifications.notify(download)
  })

  services.downloads.onDelete((download) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.downloadDeletedEvent, download)
    }
  })

  services.conversions.onUpdate((conversion) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.conversionStateEvent, conversion)
    }
  })

  services.inspectionHistory.onUpdate((entry) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.inspectionHistoryStateEvent, entry)
    }
  })

  services.inspectionHistory.onDelete((entry) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.inspectionHistoryDeleteEvent, entry)
    }
  })
}

function thumbnailOf(result: InspectionResult): string | undefined {
  return result.kind === 'playlist' ? result.playlist.thumbnail : result.media.thumbnail
}
