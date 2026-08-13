export const IPC_CHANNELS = {
  mediaInspect: 'media:inspect',
  downloadCreate: 'download:create',
  downloadStart: 'download:start',
  downloadPause: 'download:pause',
  downloadResume: 'download:resume',
  downloadCancel: 'download:cancel',
  downloadGet: 'download:get',
  downloadList: 'download:list',
  downloadRetry: 'download:retry',
  historyClear: 'history:clear',
  dialogSelectDirectory: 'dialog:select-directory',
  fileOpen: 'file:open',
  fileOpenDirectory: 'file:open-directory',
  fileOpenLocation: 'file:open-location',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  dependenciesGet: 'dependencies:get',
  downloadStateEvent: 'download:state',
  conversionStart: 'conversion:start',
  conversionCancel: 'conversion:cancel',
  conversionList: 'conversion:list',
  conversionStateEvent: 'conversion:state',
  inspectionHistoryList: 'inspectionHistory:list',
  inspectionHistoryStateEvent: 'inspectionHistory:state'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
