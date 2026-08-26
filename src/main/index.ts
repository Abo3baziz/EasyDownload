import { app, BrowserWindow, dialog, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import type { Services } from './services'
import { createServices } from './services'

let activeServices: Services | undefined
let shutdownComplete = false

function resolveWindowIcon(): string | undefined {
  const icon = join(app.getAppPath(), 'build', 'icons', '1024x1024.png')
  return existsSync(icon) ? icon : undefined
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'EasyDownload',
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function setupServices(): void {
  activeServices = createServices({
    userDataDir: app.getPath('userData'),
    defaultDownloadDirectory: app.getPath('downloads'),
    selectDirectory: async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled) {
        return null
      }
      return result.filePaths[0] ?? null
    },
    openPath: (path) => shell.openPath(path),
    showItemInFolder: (path) => shell.showItemInFolder(path),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath()
  })
  registerIpc(activeServices)
}

app.whenReady().then(() => {
  setupServices()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('before-quit', (event) => {
  const services = activeServices
  if (!services || shutdownComplete) {
    return
  }
  event.preventDefault()
  void Promise.all([services.downloads.shutdown(), services.conversions.shutdown()])
    .catch(() => undefined)
    .finally(() => {
      shutdownComplete = true
      app.quit()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
