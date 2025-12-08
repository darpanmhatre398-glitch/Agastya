/**
 * Preload script – exposes safe IPC bridge to renderer
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // License functions
  license: {
    activate: (key) => ipcRenderer.invoke('activate-key', key),
    check: () => ipcRenderer.invoke('check-license'),
    getInfo: () => ipcRenderer.invoke('get-license-info'),
    deactivate: () => ipcRenderer.invoke('deactivate-license'),
    getHWID: () => ipcRenderer.invoke('get-hwid')
  },
  
  // Operations control
  cancelOperations: () => ipcRenderer.invoke('cancel-operations'),
  
  // App info
  isElectron: true
});
