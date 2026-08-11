import { app, BrowserWindow, dialog, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { createServices } from './services'

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
    void shell.openExternal(url)
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
  const services = createServices({
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
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath()
  })
  registerIpc(services)
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
