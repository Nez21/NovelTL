import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge } from 'electron'
import { exposeElectronTRPC } from 'trpc-electron/main'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
}

process.once('loaded', async () => {
  exposeElectronTRPC()
})
