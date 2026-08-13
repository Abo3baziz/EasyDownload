import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc'
import {
  conversionStartSchema,
  downloadOptionsSchema,
  idSchema,
  inspectUrlSchema,
  pathSchema,
  settingsSchema
} from '../../shared/schemas'
import type { Services } from '../services'
import { registerIpcHandler } from './handle'

export function registerIpc(services: Services): void {
  registerIpcHandler(ipcMain, IPC_CHANNELS.mediaInspect, inspectUrlSchema, ({ url }) =>
    services.media.inspectUrl(url)
  )
  registerIpcHandler(ipcMain, IPC_CHANNELS.downloadCreate, downloadOptionsSchema, (options) =>
    services.downloads.create(options)
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

  services.downloads.onUpdate((download) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.downloadStateEvent, download)
    }
    void services.notifications.notify(download)
  })

  services.conversions.onUpdate((conversion) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.conversionStateEvent, conversion)
    }
  })
}
