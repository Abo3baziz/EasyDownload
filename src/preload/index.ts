import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/ipc'
import type { PreloadApi } from '../shared/types/preload'

const api: PreloadApi = {
  inspectUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.mediaInspect, { url }),
  startDownload: async (options) => {
    const created = await ipcRenderer.invoke(IPC_CHANNELS.downloadCreate, options)
    if (!created.ok) {
      return created
    }
    return ipcRenderer.invoke(IPC_CHANNELS.downloadStart, { id: created.data.id })
  },
  pauseDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadPause, { id }),
  resumeDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadResume, { id }),
  cancelDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadCancel, { id }),
  deleteDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadDelete, { id }),
  retryDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadRetry, { id }),
  getDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadGet, { id }),
  listDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.downloadList),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.historyClear),
  onDownloadDeleted: (listener) => subscribe(IPC_CHANNELS.downloadDeletedEvent, listener),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.dialogSelectDirectory),
  openFile: (path) => ipcRenderer.invoke(IPC_CHANNELS.fileOpen, { path }),
  openDirectory: (path) => ipcRenderer.invoke(IPC_CHANNELS.fileOpenDirectory, { path }),
  openFileLocation: (path) => ipcRenderer.invoke(IPC_CHANNELS.fileOpenLocation, { path }),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  updateSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, settings),
  getDependencies: () => ipcRenderer.invoke(IPC_CHANNELS.dependenciesGet),
  startConversion: (options) => ipcRenderer.invoke(IPC_CHANNELS.conversionStart, options),
  cancelConversion: (id) => ipcRenderer.invoke(IPC_CHANNELS.conversionCancel, { id }),
  listConversions: () => ipcRenderer.invoke(IPC_CHANNELS.conversionList),
  listInspectionHistory: () => ipcRenderer.invoke(IPC_CHANNELS.inspectionHistoryList),
  deleteInspectionHistoryEntry: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.inspectionHistoryDelete, { id }),
  onDownloadStateChange: (listener) => subscribe(IPC_CHANNELS.downloadStateEvent, listener),
  onConversionStateChange: (listener) => subscribe(IPC_CHANNELS.conversionStateEvent, listener),
  onInspectionHistoryChange: (listener) =>
    subscribe(IPC_CHANNELS.inspectionHistoryStateEvent, listener),
  onInspectionHistoryDeleted: (listener) =>
    subscribe(IPC_CHANNELS.inspectionHistoryDeleteEvent, listener)
}

function subscribe<T>(channel: string, listener: (data: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: T): void => {
    listener(data)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('mediaDownloader', api)
} else {
  // Fallback for development environments without context isolation.
  // @ts-expect-error -- window typing is declared in the renderer.
  window.mediaDownloader = api
}
