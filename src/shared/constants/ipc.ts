export const IPC_CHANNELS = {
  mediaInspect: 'media:inspect',
  downloadCreate: 'download:create',
  downloadStart: 'download:start',
  downloadCancel: 'download:cancel',
  downloadGet: 'download:get',
  downloadList: 'download:list',
  downloadRetry: 'download:retry',
  historyClear: 'history:clear',
  dialogSelectDirectory: 'dialog:select-directory',
  fileOpen: 'file:open',
  fileOpenDirectory: 'file:open-directory',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  dependenciesGet: 'dependencies:get',
  downloadStateEvent: 'download:state',
  conversionStart: 'conversion:start',
  conversionCancel: 'conversion:cancel',
  conversionList: 'conversion:list',
  conversionStateEvent: 'conversion:state'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
