import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/ipc'
import type { Download } from '../shared/types/download'
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
  cancelDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadCancel, { id }),
  retryDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadRetry, { id }),
  getDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.downloadGet, { id }),
  listDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.downloadList),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.historyClear),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.dialogSelectDirectory),
  openFile: (path) => ipcRenderer.invoke(IPC_CHANNELS.fileOpen, { path }),
  openDirectory: (path) => ipcRenderer.invoke(IPC_CHANNELS.fileOpenDirectory, { path }),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  updateSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, settings),
  getDependencies: () => ipcRenderer.invoke(IPC_CHANNELS.dependenciesGet),
  onDownloadStateChange: (listener) => subscribe(IPC_CHANNELS.downloadStateEvent, listener)
}

function subscribe(channel: string, listener: (download: Download) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, download: Download): void => {
    listener(download)
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
